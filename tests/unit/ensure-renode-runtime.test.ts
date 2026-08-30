import { expect, test } from "bun:test"
import { mkdir, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ensureRenodeRuntime, getManagedRenodeVersion } from "../../lib"

test("reuses a verified managed runtime without downloading", async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), "renode-cache-test-"))
  const version = getManagedRenodeVersion()
  const installDirectory = join(cacheDirectory, `${version}-win32-x64`)
  await mkdir(join(installDirectory, "bin"), { recursive: true })
  await Promise.all([
    writeFile(join(installDirectory, "bin", "Renode.exe"), "fixture"),
    writeFile(
      join(installDirectory, "runtime.json"),
      JSON.stringify({
        version,
        renodeCommand: "bin/Renode.exe",
      }),
    ),
  ])
  let didFetch = false

  const runtime = await ensureRenodeRuntime({
    cacheDirectory,
    platform: "win32",
    architecture: "x64",
    fetch: async () => {
      didFetch = true
      throw new Error("The cached runtime must not be downloaded again")
    },
  })

  expect(didFetch).toBe(false)
  expect(runtime).toEqual({
    version,
    renodeCommand: join(installDirectory, "bin", "Renode.exe"),
    installDirectory,
  })
})

test("rejects an unsupported host before downloading", async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), "renode-cache-test-"))
  let didFetch = false

  const result = ensureRenodeRuntime({
    cacheDirectory,
    platform: "freebsd",
    architecture: "riscv64",
    fetch: async () => {
      didFetch = true
      throw new Error("Unsupported hosts must not fetch")
    },
  })

  await expect(result).rejects.toThrow("is not available for freebsd-riscv64")
  expect(didFetch).toBe(false)
})

test("rejects a downloaded runtime with the wrong checksum", async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), "renode-cache-test-"))

  const result = ensureRenodeRuntime({
    cacheDirectory,
    platform: "win32",
    architecture: "x64",
    fetch: async () => new Response("not a Renode release"),
  })

  await expect(result).rejects.toThrow("Renode download checksum mismatch")
})
