import { existsSync } from 'node:fs'
import { readFile } from 'node:fs/promises'
import ts from 'typescript'

// Load actual TSX components (including child components) for server-rendered UI tests.
const modules = new Map()
async function componentUrl(url) {
  if (modules.has(url.href)) return modules.get(url.href)
  const source = await readFile(url, 'utf8')
  let compiled = ts.transpileModule(source, {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText.replace(/^import ['"][^'"]+\.css['"];?$/gm, '')
  const imports = [...compiled.matchAll(/^(import .+? from )(['"])([^'"]+)\2;?$/gm)]
  for (const [statement, prefix, quote, specifier] of imports) {
    let resolved
    if (specifier.startsWith('.')) {
      const child = new URL(`${specifier}.tsx`, url)
      resolved = existsSync(child) ? await componentUrl(child) : new URL(`${specifier}.ts`, url).href
    } else {
      resolved = import.meta.resolve(specifier)
    }
    compiled = compiled.replace(statement, `${prefix}${quote}${resolved}${quote};`)
  }
  const result = `data:text/javascript;base64,${Buffer.from(compiled).toString('base64')}`
  modules.set(url.href, result)
  return result
}

export async function loadComponent(url) {
  return (await import(await componentUrl(url))).default
}
