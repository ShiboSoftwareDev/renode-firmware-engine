import { spawn } from "node:child_process"
import { createHash } from "node:crypto"
import {
  chmod,
  cp,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises"
import {
  arch as getArchitecture,
  platform as getPlatform,
  homedir,
} from "node:os"
import path from "node:path"

const managedRenodeVersion = "1.16.1"
const installLockTimeoutMilliseconds = 5 * 60_000

interface RenodeRuntimeAsset {
  archiveType: "dmg" | "tar.gz" | "zip"
  fileName: string
  sha256: string
}

const runtimeAssets: Record<string, RenodeRuntimeAsset> = {
  "darwin-arm64": {
    archiveType: "dmg",
    fileName: "renode-1.16.1-dotnet.osx-arm64-portable.dmg",
    sha256: "99b8ae5897b8926ef179868d39a504fe5296555dc9c9b973718ddf3ab09175d9",
  },
  "darwin-x64": {
    archiveType: "dmg",
    fileName: "renode_1.16.1.dmg",
    sha256: "7879b2851b446ff99e1d3910b499af278fbd76a3fa8fe5c0d379f30afa0c4ed1",
  },
  "linux-arm64": {
    archiveType: "tar.gz",
    fileName: "renode-1.16.1.linux-arm64-portable-dotnet.tar.gz",
    sha256: "fff3a098c96ed0a4ffbdff3f028c9c5fde432db09587c7bd7c99406180f90007",
  },
  "linux-x64": {
    archiveType: "tar.gz",
    fileName: "renode-1.16.1.linux-portable-dotnet.tar.gz",
    sha256: "00e113cdbd0f5354cf2f64bbe3f5a070d8958409542fca66e45ac97d982938c0",
  },
  "win32-x64": {
    archiveType: "zip",
    fileName: "renode-1.16.1.windows-portable-dotnet.zip",
    sha256: "d09b7934cfd560cd06bde8f131ef78f521f10d423d5aac6096f2a583224aeb3e",
  },
}

export interface RenodeRuntime {
  version: string
  renodeCommand: string
  installDirectory: string
}

export interface EnsureRenodeRuntimeOptions {
  cacheDirectory?: string
  platform?: NodeJS.Platform
  architecture?: string
  fetch?: (
    input: string | URL | Request,
    init?: RequestInit,
  ) => Promise<Response>
  onProgress?: (message: string) => void
}

interface RuntimeMarker {
  version: string
  renodeCommand: string
}

const runProcess = async (request: {
  command: string
  arguments: string[]
  cwd?: string
  timeoutMilliseconds?: number
}): Promise<void> => {
  const child = spawn(request.command, request.arguments, {
    cwd: request.cwd,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
  })
  let stdout = ""
  let stderr = ""
  child.stdout.on("data", (chunk: Buffer) => {
    stdout = `${stdout}${chunk.toString("utf8")}`.slice(-32_768)
  })
  child.stderr.on("data", (chunk: Buffer) => {
    stderr = `${stderr}${chunk.toString("utf8")}`.slice(-32_768)
  })
  const timeoutMilliseconds = request.timeoutMilliseconds ?? 120_000
  const timeout = setTimeout(() => child.kill("SIGKILL"), timeoutMilliseconds)
  const exitCode = await new Promise<number | null>((resolve, reject) => {
    child.once("error", reject)
    child.once("close", resolve)
  }).finally(() => clearTimeout(timeout))
  if (exitCode !== 0) {
    throw new Error(
      `${request.command} exited with ${exitCode ?? "no status"}${stderr.trim() || stdout.trim() ? `\n${stderr.trim() || stdout.trim()}` : ""}`,
    )
  }
}

const getDefaultCacheDirectory = (): string => {
  if (process.env.TSCIRCUIT_RENODE_CACHE_DIR) {
    return path.resolve(process.env.TSCIRCUIT_RENODE_CACHE_DIR)
  }
  if (process.platform === "darwin") {
    return path.join(homedir(), "Library", "Caches", "tscircuit", "renode")
  }
  if (process.platform === "win32") {
    return path.join(
      process.env.LOCALAPPDATA ?? path.join(homedir(), "AppData", "Local"),
      "tscircuit",
      "renode",
    )
  }
  return path.join(
    process.env.XDG_CACHE_HOME ?? path.join(homedir(), ".cache"),
    "tscircuit",
    "renode",
  )
}

const fileExists = async (filePath: string): Promise<boolean> =>
  (await stat(filePath).catch(() => undefined))?.isFile() === true

const delay = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const readRuntimeMarker = async (
  installDirectory: string,
): Promise<RenodeRuntime | undefined> => {
  const markerPath = path.join(installDirectory, "runtime.json")
  const marker = JSON.parse(
    await readFile(markerPath, "utf8").catch(() => "null"),
  ) as RuntimeMarker | null
  if (!marker || marker.version !== managedRenodeVersion) return undefined
  const renodeCommand = path.join(installDirectory, marker.renodeCommand)
  if (!(await fileExists(renodeCommand))) return undefined
  return {
    version: marker.version,
    renodeCommand,
    installDirectory,
  }
}

const findFile = async (
  directory: string,
  names: string[],
): Promise<string | undefined> => {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name)
    if (entry.isFile() && names.includes(entry.name)) return entryPath
    if (!entry.isDirectory()) continue
    const nested = await findFile(entryPath, names)
    if (nested) return nested
  }
  return undefined
}

const extractDmg = async (request: {
  archivePath: string
  outputDirectory: string
  temporaryDirectory: string
}): Promise<void> => {
  const mountDirectory = path.join(request.temporaryDirectory, "mount")
  await mkdir(mountDirectory)
  await runProcess({
    command: "hdiutil",
    arguments: [
      "attach",
      "-readonly",
      "-nobrowse",
      "-mountpoint",
      mountDirectory,
      request.archivePath,
    ],
  })
  try {
    const appName = (await readdir(mountDirectory)).find((name) =>
      name.endsWith(".app"),
    )
    if (!appName) throw new Error("The Renode disk image has no application")
    await cp(
      path.join(mountDirectory, appName),
      path.join(request.outputDirectory, appName),
      { recursive: true },
    )
  } finally {
    await runProcess({
      command: "hdiutil",
      arguments: ["detach", mountDirectory],
    }).catch(() => undefined)
  }
}

const extractArchive = async (request: {
  asset: RenodeRuntimeAsset
  archivePath: string
  outputDirectory: string
  temporaryDirectory: string
}): Promise<void> => {
  await mkdir(request.outputDirectory, { recursive: true })
  if (request.asset.archiveType === "dmg") {
    await extractDmg(request)
    return
  }
  if (request.asset.archiveType === "tar.gz") {
    await runProcess({
      command: "tar",
      arguments: ["-xzf", request.archivePath, "-C", request.outputDirectory],
    })
    return
  }
  await runProcess({
    command: "powershell.exe",
    arguments: [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      "Expand-Archive",
      "-LiteralPath",
      request.archivePath,
      "-DestinationPath",
      request.outputDirectory,
      "-Force",
    ],
  })
}

const downloadRuntime = async (request: {
  asset: RenodeRuntimeAsset
  fetchImplementation: NonNullable<EnsureRenodeRuntimeOptions["fetch"]>
  archivePath: string
  onProgress?: (message: string) => void
}): Promise<void> => {
  const url = `https://github.com/renode/renode/releases/download/v${managedRenodeVersion}/${request.asset.fileName}`
  request.onProgress?.(`Downloading Renode ${managedRenodeVersion}`)
  const response = await request.fetchImplementation(url)
  if (!response.ok) {
    throw new Error(
      `Unable to download Renode ${managedRenodeVersion}: HTTP ${response.status}`,
    )
  }
  const bytes = Buffer.from(await response.arrayBuffer())
  const sha256 = createHash("sha256").update(bytes).digest("hex")
  if (sha256 !== request.asset.sha256) {
    throw new Error(
      `Renode download checksum mismatch: expected ${request.asset.sha256}, received ${sha256}`,
    )
  }
  await writeFile(request.archivePath, bytes)
}

const installRuntime = async (request: {
  asset: RenodeRuntimeAsset
  installDirectory: string
  cacheDirectory: string
  fetchImplementation: NonNullable<EnsureRenodeRuntimeOptions["fetch"]>
  onProgress?: (message: string) => void
}): Promise<RenodeRuntime> => {
  const temporaryDirectory = await mkdtemp(
    path.join(request.cacheDirectory, ".install-"),
  )
  const archivePath = path.join(temporaryDirectory, request.asset.fileName)
  const outputDirectory = path.join(temporaryDirectory, "runtime")
  try {
    await downloadRuntime({
      asset: request.asset,
      fetchImplementation: request.fetchImplementation,
      archivePath,
      onProgress: request.onProgress,
    })
    request.onProgress?.(`Installing Renode ${managedRenodeVersion}`)
    await extractArchive({
      asset: request.asset,
      archivePath,
      outputDirectory,
      temporaryDirectory,
    })
    const renodeCommand = await findFile(outputDirectory, [
      "renode",
      "Renode.exe",
    ])
    if (!renodeCommand) {
      throw new Error("The Renode runtime archive is missing its executable")
    }
    if (process.platform !== "win32") {
      await chmod(renodeCommand, 0o755)
    }
    const marker: RuntimeMarker = {
      version: managedRenodeVersion,
      renodeCommand: path.relative(outputDirectory, renodeCommand),
    }
    await writeFile(
      path.join(outputDirectory, "runtime.json"),
      `${JSON.stringify(marker, null, 2)}\n`,
    )
    await rm(request.installDirectory, { recursive: true, force: true })
    await rename(outputDirectory, request.installDirectory)
    request.onProgress?.(`Renode ${managedRenodeVersion} is ready`)
    const runtime = await readRuntimeMarker(request.installDirectory)
    if (!runtime) throw new Error("Installed Renode runtime is invalid")
    return runtime
  } finally {
    await rm(temporaryDirectory, { recursive: true, force: true })
  }
}

const runtimePromises = new Map<string, Promise<RenodeRuntime>>()

const installRuntimeWithLock = async (request: {
  asset: RenodeRuntimeAsset
  installDirectory: string
  cacheDirectory: string
  fetchImplementation: NonNullable<EnsureRenodeRuntimeOptions["fetch"]>
  onProgress?: (message: string) => void
}): Promise<RenodeRuntime> => {
  const lockDirectory = `${request.installDirectory}.lock`
  const startedAt = Date.now()
  while (true) {
    const existingRuntime = await readRuntimeMarker(request.installDirectory)
    if (existingRuntime) return existingRuntime
    const acquired = await mkdir(lockDirectory).then(
      () => true,
      (error: NodeJS.ErrnoException) => {
        if (error.code === "EEXIST") return false
        throw error
      },
    )
    if (acquired) {
      try {
        const runtimeInstalledWhileLocking = await readRuntimeMarker(
          request.installDirectory,
        )
        if (runtimeInstalledWhileLocking) return runtimeInstalledWhileLocking
        return await installRuntime(request)
      } finally {
        await rm(lockDirectory, { recursive: true, force: true })
      }
    }
    if (Date.now() - startedAt >= installLockTimeoutMilliseconds) {
      throw new Error(
        `Timed out waiting for another process to install Renode ${managedRenodeVersion}`,
      )
    }
    request.onProgress?.(
      `Waiting for another process to install Renode ${managedRenodeVersion}`,
    )
    await delay(250)
  }
}

export const ensureRenodeRuntime = (
  options: EnsureRenodeRuntimeOptions = {},
): Promise<RenodeRuntime> => {
  const platform = options.platform ?? getPlatform()
  const architecture = options.architecture ?? getArchitecture()
  const cacheDirectory = path.resolve(
    options.cacheDirectory ?? getDefaultCacheDirectory(),
  )
  const promiseKey = `${cacheDirectory}\0${platform}\0${architecture}`
  const existingPromise = runtimePromises.get(promiseKey)
  if (existingPromise) return existingPromise
  const runtimePromise = (async () => {
    const asset = runtimeAssets[`${platform}-${architecture}`]
    if (!asset) {
      throw new Error(
        `Renode ${managedRenodeVersion} is not available for ${platform}-${architecture}`,
      )
    }
    const installDirectory = path.join(
      cacheDirectory,
      `${managedRenodeVersion}-${platform}-${architecture}`,
    )
    const existingRuntime = await readRuntimeMarker(installDirectory)
    if (existingRuntime) return existingRuntime
    await mkdir(cacheDirectory, { recursive: true })
    return installRuntimeWithLock({
      asset,
      installDirectory,
      cacheDirectory,
      fetchImplementation: options.fetch ?? fetch,
      onProgress: options.onProgress,
    })
  })().catch((error) => {
    runtimePromises.delete(promiseKey)
    throw error
  })
  runtimePromises.set(promiseKey, runtimePromise)
  return runtimePromise
}

export const getManagedRenodeVersion = (): string => managedRenodeVersion
