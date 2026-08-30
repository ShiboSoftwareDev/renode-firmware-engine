import { connect, type Socket } from "node:net"

const promptPattern = /\r?\n?\([^)]+\) $/

const wait = (milliseconds: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, milliseconds))

const stripTelnetNegotiation = (chunk: Buffer): string => {
  const plainBytes: number[] = []
  for (let index = 0; index < chunk.length; index += 1) {
    const byte = chunk[index]
    if (byte === undefined) continue
    if (byte === 0xff && index + 2 < chunk.length) {
      index += 2
      continue
    }
    if (byte !== 0) plainBytes.push(byte)
  }
  return Buffer.from(plainBytes).toString("utf8")
}

const openSocket = (request: { host: string; port: number }): Promise<Socket> =>
  new Promise((resolve, reject) => {
    const socket = connect(request)
    const onError = (error: Error) => {
      socket.off("connect", onConnect)
      reject(error)
    }
    const onConnect = () => {
      socket.off("error", onError)
      socket.setNoDelay(true)
      resolve(socket)
    }
    socket.once("error", onError)
    socket.once("connect", onConnect)
  })

export class RenodeMonitorClient {
  private receivedText = ""
  private commandQueue: Promise<unknown> = Promise.resolve()
  private terminalError?: Error

  private constructor(private readonly socket: Socket) {
    socket.on("data", (chunk: Buffer) => {
      this.receivedText += stripTelnetNegotiation(chunk)
    })
    socket.on("error", (error) => {
      this.terminalError = error
    })
    socket.on("close", () => {
      this.terminalError ??= new Error("Renode monitor connection closed")
    })
  }

  static async connect(request: {
    host: string
    port: number
    timeoutMilliseconds: number
  }): Promise<RenodeMonitorClient> {
    const deadline = Date.now() + request.timeoutMilliseconds
    let lastError: unknown
    while (Date.now() < deadline) {
      let socket: Socket | undefined
      try {
        socket = await openSocket(request)
        const client = new RenodeMonitorClient(socket)
        await client.waitForPrompt(request.timeoutMilliseconds)
        client.receivedText = ""
        return client
      } catch (error) {
        socket?.destroy()
        lastError = error
        await wait(100)
      }
    }
    throw new Error(
      `Timed out connecting to the Renode monitor at ${request.host}:${request.port}${lastError instanceof Error ? `: ${lastError.message}` : ""}`,
    )
  }

  execute(command: string, timeoutMilliseconds = 20_000): Promise<string> {
    if (!command.trim() || /[\r\n]/.test(command)) {
      return Promise.reject(
        new Error("Renode monitor commands must be one line"),
      )
    }
    const execution = this.commandQueue.then(() =>
      this.executeImmediately(command, timeoutMilliseconds),
    )
    this.commandQueue = execution.catch(() => undefined)
    return execution
  }

  close(): void {
    if (!this.socket.destroyed) {
      this.socket.write("quit\n")
      this.socket.end()
    }
  }

  private async executeImmediately(
    command: string,
    timeoutMilliseconds: number,
  ): Promise<string> {
    if (this.terminalError) throw this.terminalError
    this.receivedText = ""
    this.socket.write(`${command}\n`)
    await this.waitForPrompt(timeoutMilliseconds)
    const response = this.receivedText
    this.receivedText = ""
    if (response.includes("There was an error executing command")) {
      throw new Error(response.trim())
    }
    return response
  }

  private async waitForPrompt(timeoutMilliseconds: number): Promise<void> {
    const deadline = Date.now() + timeoutMilliseconds
    while (Date.now() < deadline) {
      if (this.terminalError) throw this.terminalError
      if (promptPattern.test(this.receivedText)) return
      await wait(10)
    }
    throw new Error(
      `Timed out waiting for the Renode monitor after ${timeoutMilliseconds}ms`,
    )
  }
}
