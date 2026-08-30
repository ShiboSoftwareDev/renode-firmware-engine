import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import { connect, type Socket } from "node:net"
import { join } from "node:path"
import type {
  FirmwareProgrammingResult,
  RenodeUsbProgrammingRequest,
} from "./types"

const usbIpVersion = 0x0111
const requestImport = 0x8003
const responseImport = 0x0003
const requestDeviceList = 0x8005
const responseDeviceList = 0x0005
const commandSubmit = 0x00000001
const responseSubmit = 0x00000003
const usbIpDirectionOut = 0
const usbIpDirectionIn = 1
const usbIpDeviceDescriptorSize = 312
const arduinoLoaderBufferSize = 0x0f0000

interface UsbIpDevice {
  busId: string
  busNumber: number
  deviceNumber: number
  vendorId: number
  productId: number
  interfaceCount: number
}

interface UsbIpSession {
  socket: Socket
  reader: SocketReader
  deviceId: number
  sequence: number
}

export interface SamBaUsbIpRequest {
  host: string
  port: number
  workspaceDirectory: string
  programming: RenodeUsbProgrammingRequest
  signal?: AbortSignal
}

class SocketReader {
  private chunks: Buffer[] = []
  private bufferedBytes = 0
  private pendingReads: Array<{
    size: number
    resolve: (bytes: Buffer) => void
    reject: (error: Error) => void
  }> = []
  private terminalError?: Error

  constructor(socket: Socket) {
    socket.on("data", (chunk: Buffer) => {
      this.chunks.push(chunk)
      this.bufferedBytes += chunk.length
      this.flushPendingReads()
    })
    socket.on("end", () => {
      this.fail(new Error("USB/IP connection ended unexpectedly"))
    })
    socket.on("error", (error) => this.fail(error))
  }

  readExactly(size: number): Promise<Buffer> {
    if (this.terminalError) return Promise.reject(this.terminalError)
    if (this.bufferedBytes >= size) return Promise.resolve(this.take(size))
    return new Promise((resolve, reject) => {
      this.pendingReads.push({ size, resolve, reject })
    })
  }

  private fail(error: Error): void {
    if (this.terminalError) return
    this.terminalError = error
    for (const pendingRead of this.pendingReads.splice(0)) {
      pendingRead.reject(error)
    }
  }

  private flushPendingReads(): void {
    while (
      this.pendingReads[0] &&
      this.bufferedBytes >= this.pendingReads[0].size
    ) {
      const pendingRead = this.pendingReads.shift()
      if (!pendingRead) return
      pendingRead.resolve(this.take(pendingRead.size))
    }
  }

  private take(size: number): Buffer {
    const output = Buffer.allocUnsafe(size)
    let outputOffset = 0
    while (outputOffset < size) {
      const chunk = this.chunks[0]
      if (!chunk) throw new Error("USB/IP reader buffer underflow")
      const bytesToCopy = Math.min(chunk.length, size - outputOffset)
      chunk.copy(output, outputOffset, 0, bytesToCopy)
      outputOffset += bytesToCopy
      this.bufferedBytes -= bytesToCopy
      if (bytesToCopy === chunk.length) this.chunks.shift()
      else this.chunks[0] = chunk.subarray(bytesToCopy)
    }
    return output
  }
}

const throwIfAborted = (signal?: AbortSignal): void => {
  if (!signal?.aborted) return
  throw signal.reason instanceof Error
    ? signal.reason
    : new Error("USB programming was aborted")
}

const wait = (milliseconds: number, signal?: AbortSignal): Promise<void> =>
  new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(
        signal.reason instanceof Error
          ? signal.reason
          : new Error("USB programming was aborted"),
      )
      return
    }
    const onAbort = () => {
      clearTimeout(timeout)
      reject(
        signal?.reason instanceof Error
          ? signal.reason
          : new Error("USB programming was aborted"),
      )
    }
    const timeout = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort)
      resolve()
    }, milliseconds)
    signal?.addEventListener("abort", onAbort, { once: true })
  })

const openSocket = (request: {
  host: string
  port: number
  signal?: AbortSignal
}): Promise<{ socket: Socket; reader: SocketReader }> =>
  new Promise((resolve, reject) => {
    throwIfAborted(request.signal)
    const socket = connect({ host: request.host, port: request.port })
    const reader = new SocketReader(socket)
    const onAbort = () =>
      socket.destroy(
        request.signal?.reason instanceof Error
          ? request.signal.reason
          : new Error("USB programming aborted"),
      )
    const onConnectionError = (error: Error) => {
      socket.off("connect", onConnect)
      reject(error)
    }
    const onConnect = () => {
      socket.off("error", onConnectionError)
      socket.setNoDelay(true)
      resolve({ socket, reader })
    }
    request.signal?.addEventListener("abort", onAbort, { once: true })
    socket.once("close", () => {
      request.signal?.removeEventListener("abort", onAbort)
    })
    socket.once("connect", onConnect)
    socket.once("error", onConnectionError)
  })

const createOperationHeader = (operation: number): Buffer => {
  const header = Buffer.alloc(8)
  header.writeUInt16BE(usbIpVersion, 0)
  header.writeUInt16BE(operation, 2)
  return header
}

const readOperationResponse = async (
  reader: SocketReader,
): Promise<{ operation: number; status: number }> => {
  const response = await reader.readExactly(8)
  const version = response.readUInt16BE(0)
  if (version !== usbIpVersion) {
    throw new Error(`Unsupported USB/IP version 0x${version.toString(16)}`)
  }
  return {
    operation: response.readUInt16BE(2),
    status: response.readUInt32BE(4),
  }
}

const readDeviceDescriptor = async (
  reader: SocketReader,
): Promise<UsbIpDevice> => {
  const descriptor = await reader.readExactly(usbIpDeviceDescriptorSize)
  const interfaceCount = descriptor.readUInt8(311)
  return {
    busId: descriptor.subarray(256, 288).toString("ascii").split("\0")[0] ?? "",
    busNumber: descriptor.readUInt32BE(288),
    deviceNumber: descriptor.readUInt32BE(292),
    vendorId: descriptor.readUInt16BE(300),
    productId: descriptor.readUInt16BE(302),
    interfaceCount,
  }
}

const listDevices = async (request: {
  host: string
  port: number
  signal?: AbortSignal
}): Promise<UsbIpDevice[]> => {
  const { socket, reader } = await openSocket(request)
  try {
    socket.write(createOperationHeader(requestDeviceList))
    const response = await readOperationResponse(reader)
    if (response.operation !== responseDeviceList || response.status !== 0) {
      throw new Error(`USB/IP device-list request failed (${response.status})`)
    }
    const count = (await reader.readExactly(4)).readUInt32BE(0)
    const devices: UsbIpDevice[] = []
    for (let index = 0; index < count; index += 1) {
      const device = await readDeviceDescriptor(reader)
      await reader.readExactly(device.interfaceCount * 4)
      devices.push(device)
    }
    return devices
  } finally {
    socket.end()
  }
}

const waitForDevice = async (
  request: SamBaUsbIpRequest,
): Promise<UsbIpDevice> => {
  const deadline = Date.now() + request.programming.timeoutMilliseconds
  let lastError: unknown
  while (Date.now() < deadline) {
    throwIfAborted(request.signal)
    try {
      const devices = await listDevices(request)
      const device = devices.find(
        (candidate) =>
          candidate.vendorId === request.programming.vendorId &&
          candidate.productId === request.programming.productId,
      )
      if (device) return device
    } catch (error) {
      lastError = error
    }
    await wait(100, request.signal)
  }
  const identity = `${request.programming.vendorId.toString(16).padStart(4, "0")}:${request.programming.productId.toString(16).padStart(4, "0")}`
  throw new Error(
    `Timed out waiting for USB bootloader ${identity} at ${request.host}:${request.port}${lastError instanceof Error ? `: ${lastError.message}` : ""}`,
  )
}

const importDevice = async (
  request: SamBaUsbIpRequest,
  device: UsbIpDevice,
): Promise<UsbIpSession> => {
  const { socket, reader } = await openSocket(request)
  socket.write(createOperationHeader(requestImport))
  const busId = Buffer.alloc(32)
  busId.write(device.busId, 0, 31, "ascii")
  socket.write(busId)
  const response = await readOperationResponse(reader)
  if (response.operation !== responseImport || response.status !== 0) {
    socket.destroy()
    throw new Error(`USB/IP import failed (${response.status})`)
  }
  const importedDevice = await readDeviceDescriptor(reader)
  if (importedDevice.busId !== device.busId) {
    socket.destroy()
    throw new Error("USB/IP imported an unexpected device")
  }
  return {
    socket,
    reader,
    deviceId:
      ((device.busNumber & 0xffff) << 16) | (device.deviceNumber & 0xffff),
    sequence: 1,
  }
}

const submitTransfer = async (request: {
  session: UsbIpSession
  direction: number
  endpoint: number
  payload?: Buffer
  expectedLength?: number
  setup?: Buffer
}): Promise<Buffer> => {
  const payload = request.payload ?? Buffer.alloc(0)
  const expectedLength = request.expectedLength ?? payload.length
  const sequence = request.session.sequence
  request.session.sequence += 1
  const header = Buffer.alloc(48)
  header.writeUInt32BE(commandSubmit, 0)
  header.writeUInt32BE(sequence, 4)
  header.writeUInt32BE(request.session.deviceId, 8)
  header.writeUInt32BE(request.direction, 12)
  header.writeUInt32BE(request.endpoint, 16)
  header.writeInt32BE(expectedLength, 24)
  const setup = request.setup ?? Buffer.alloc(8)
  setup.copy(header, 40)
  request.session.socket.write(header)
  if (payload.length > 0) request.session.socket.write(payload)

  const response = await request.session.reader.readExactly(48)
  if (response.readUInt32BE(0) !== responseSubmit) {
    throw new Error("USB/IP returned an unexpected transfer response")
  }
  if (response.readUInt32BE(4) !== sequence) {
    throw new Error("USB/IP transfer sequence mismatch")
  }
  const status = response.readInt32BE(20)
  if (status !== 0) throw new Error(`USB transfer failed with status ${status}`)
  const actualLength = response.readUInt32BE(24)
  if (request.direction !== usbIpDirectionIn || actualLength === 0) {
    return Buffer.alloc(0)
  }
  return request.session.reader.readExactly(actualLength)
}

const setConfiguration = async (session: UsbIpSession): Promise<void> => {
  const setup = Buffer.alloc(8)
  setup.writeUInt8(0x00, 0)
  setup.writeUInt8(0x09, 1)
  setup.writeUInt16LE(1, 2)
  await submitTransfer({
    session,
    direction: usbIpDirectionOut,
    endpoint: 0,
    setup,
  })
}

const bulkWrite = (session: UsbIpSession, payload: Buffer): Promise<Buffer> =>
  submitTransfer({
    session,
    direction: usbIpDirectionOut,
    endpoint: 2,
    payload,
  })

const bulkRead = (session: UsbIpSession): Promise<Buffer> =>
  submitTransfer({
    session,
    direction: usbIpDirectionIn,
    endpoint: 3,
    expectedLength: 64,
  })

const readAcknowledgement = async (
  session: UsbIpSession,
  expected: string,
): Promise<void> => {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const response = await bulkRead(session)
    if (response.length === 0) {
      await wait(10)
      continue
    }
    const responseText = response.toString("ascii").trim()
    if (responseText === expected) return
    throw new Error(
      `SAM-BA expected acknowledgement "${expected}", received "${responseText}"`,
    )
  }
  throw new Error(`SAM-BA did not acknowledge "${expected}"`)
}

export const programSamBaOverUsbIp = async (
  request: SamBaUsbIpRequest,
): Promise<FirmwareProgrammingResult> => {
  const firmware = await readFile(
    join(request.workspaceDirectory, request.programming.firmwareFileName),
  )
  if (firmware.length === 0) {
    throw new Error("Cannot program an empty firmware binary")
  }
  if (firmware.length > arduinoLoaderBufferSize) {
    throw new Error(
      `Firmware binary is ${firmware.length} bytes; the Renode SAM-BA loader supports at most ${arduinoLoaderBufferSize} bytes`,
    )
  }
  const device = await waitForDevice(request)
  const session = await importDevice(request, device)
  try {
    await setConfiguration(session)
    await bulkWrite(session, Buffer.from("X#", "ascii"))
    await readAcknowledgement(session, "X")

    for (
      let offset = 0;
      offset < firmware.length;
      offset += request.programming.chunkSizeBytes
    ) {
      throwIfAborted(request.signal)
      const chunk = firmware.subarray(
        offset,
        offset + request.programming.chunkSizeBytes,
      )
      await bulkWrite(
        session,
        Buffer.from(`S0,${chunk.length.toString(16)}#`, "ascii"),
      )
      await bulkWrite(session, chunk)
      await bulkWrite(
        session,
        Buffer.from(`Y0,${chunk.length.toString(16)}#`, "ascii"),
      )
      await readAcknowledgement(session, "Y")
    }

    await bulkWrite(session, Buffer.from("K#", "ascii"))
    return {
      method: "usb_sam_ba",
      bytesWritten: firmware.length,
      sha256: createHash("sha256").update(firmware).digest("hex"),
      isVerified: true,
    }
  } finally {
    session.socket.end()
  }
}
