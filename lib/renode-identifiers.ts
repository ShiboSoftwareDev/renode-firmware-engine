const RENODE_IDENTIFIER = /^[A-Za-z_][A-Za-z0-9_]*$/
const RENODE_REPL_PATH = /^[A-Za-z0-9_./-]+$/

export const toRenodeIdentifier = (componentName: string): string => {
  const normalizedName = componentName.replace(/[^A-Za-z0-9_]/g, "_")
  if (!normalizedName) throw new Error("Renode component names cannot be empty")
  return /^[A-Za-z_]/.test(normalizedName)
    ? normalizedName
    : `component_${normalizedName}`
}

export const assertRenodeIdentifier = (
  renodeIdentifier: string,
  description: string,
): void => {
  if (RENODE_IDENTIFIER.test(renodeIdentifier)) return
  throw new Error(
    `${description} must be a Renode identifier, received "${renodeIdentifier}"`,
  )
}

export const assertRenodeReplPath = (platformRepl: string): void => {
  const hasParentTraversal = platformRepl.split("/").includes("..")
  if (RENODE_REPL_PATH.test(platformRepl) && !hasParentTraversal) return
  throw new Error(`Invalid Renode platform path "${platformRepl}"`)
}
