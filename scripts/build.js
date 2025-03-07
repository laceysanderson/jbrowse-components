const fs = require('fs')
const path = require('path')
const { DepGraph } = require('dependency-graph')
const spawn = require('cross-spawn')
const workspaceRoot = require('find-yarn-workspace-root')()

const DEPENDENCY_TYPES = [
  'devDependencies',
  'dependencies',
  'optionalDependencies',
  'peerDependencies',
]

function main() {
  // Get packages in all workspaces
  const packages = getPackages()
  // Make a dependency graph of packages (includes peerDependencies)
  const graph = getDependencyGraph(packages)
  // Get the levels of the graph. Each level is a list of packages that can all
  // be build concurrently as long as the previous levels have been built
  const levels = getLevels(graph)
  levels.forEach(level => {
    const scopes = []
    level.forEach(pkg => {
      scopes.push('--scope', pkg)
    })
    const { signal, status } = spawn.sync(
      'yarn',
      ['lerna', 'exec', 'yarn', 'pack', ...scopes],
      { stdio: 'inherit' },
    )
    if (signal || (status !== null && status > 0)) {
      process.exit(status || 1)
    }
  })
  const subDirs = ['cgv', 'lgv', 'react-app']
  subDirs.forEach(dir => {
    fs.mkdirSync(path.join('component_tests', dir, 'packed'), {
      recursive: true,
    })
  })

  Object.values(packages).forEach(packageInfo => {
    let { location } = packageInfo
    if (location === 'packages/core') {
      const files = fs.readdirSync(location)
      const tarball = files.find(fileName => fileName.endsWith('.tgz'))
      fs.unlinkSync(path.join(location, tarball))
      location = path.join(location, 'dist')
      const { signal, status } = spawn.sync(
        'yarn',
        ['pack', '--ignore-scripts'],
        { stdio: 'inherit', cwd: location },
      )
      if (signal || (status !== null && status > 0)) {
        process.exit(status || 1)
      }
    }
    const files = fs.readdirSync(location)
    const tarball = files.find(fileName => fileName.endsWith('.tgz'))
    if (!tarball) {
      console.warn(`No tarball from ${location}`)
      return
    }
    const newTarballName = tarball.replace(/-v\d+\.\d+\.\d+/, '')
    subDirs.forEach(dir => {
      fs.copyFileSync(
        path.join(location, tarball),
        path.join('component_tests', dir, 'packed', newTarballName),
      )
    })

    fs.rmSync(path.join(location, tarball))
  })
}

function getPackages() {
  const workspacesInfoJson = spawn.sync(
    'yarn',
    ['--json', 'workspaces', 'info'],
    { encoding: 'utf8' },
  ).stdout
  const workspacesInfo = JSON.parse(workspacesInfoJson)
  return JSON.parse(workspacesInfo.data)
}

function getDependencyGraph(packages) {
  const graph = new DepGraph()
  Object.entries(packages).forEach(([packageName, packageInfo]) => {
    if (!graph.hasNode(packageName)) {
      graph.addNode(packageName)
    }
    const dependencies = []
    const packageJsonText = fs.readFileSync(
      path.join(workspaceRoot, packageInfo.location, 'package.json'),
    )
    const packageJson = JSON.parse(packageJsonText)
    for (const dt of DEPENDENCY_TYPES) {
      if (packageJson[dt]) {
        for (const k of Object.keys(packageJson[dt])) {
          if (!dependencies.includes(k) && packages[k]) {
            dependencies.push(k)
          }
        }
      }
    }
    for (const dep of dependencies) {
      if (!graph.hasNode(dep)) {
        graph.addNode(dep)
      }
      graph.addDependency(packageName, dep)
    }
  })
  return graph
}

function getLevels(graph, levels = []) {
  const done = levels.flat()
  const newLevel = []
  for (const n of [...graph.nodes.keys()].filter(n => !done.includes(n))) {
    const deps = graph.dependenciesOf(n)
    if (!done.includes(n) && deps.every(d => done.includes(d))) {
      newLevel.push(n)
    }
  }
  levels.push(newLevel)
  if (graph.size() !== done.length + newLevel.length) {
    getLevels(graph, levels)
  }
  return levels
}

main()
