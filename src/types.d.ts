export {}

declare global {
  interface Window {
    dockerApi?: {
      listContainers: () => Promise<{
        ok: boolean
        data?: any[]
        error?: string
      }>
      listVolumes: () => Promise<{
        ok: boolean
        data?: any[]
        error?: string
      }>
      listImages: () => Promise<{
        ok: boolean
        data?: any[]
        error?: string
      }>
      startContainer: (id: string) => Promise<{
        ok: boolean
        error?: string
      }>
      stopContainer: (id: string) => Promise<{
        ok: boolean
        error?: string
      }>
      removeContainer: (id: string) => Promise<{
        ok: boolean
        error?: string
      }>
      inspectContainer: (id: string) => Promise<{
        ok: boolean
        data?: any
        error?: string
      }>
      logsContainer: (id: string) => Promise<{
        ok: boolean
        data?: string
        error?: string
      }>
      composeLogs: (project: string) => Promise<{
        ok: boolean
        data?: string
        error?: string
      }>
      composeInspect: (project: string, projectDir: string) => Promise<{
        ok: boolean
        data?: any
        error?: string
      }>
      removeVolume: (name: string) => Promise<{
        ok: boolean
        error?: string
      }>
      inspectVolume: (name: string) => Promise<{
        ok: boolean
        data?: any
        error?: string
      }>
      removeImage: (name: string) => Promise<{
        ok: boolean
        error?: string
      }>
      inspectImage: (name: string) => Promise<{
        ok: boolean
        data?: any
        error?: string
      }>
      openInVSCode: (path: string) => Promise<{
        ok: boolean
        error?: string
      }>
      openErrorWindow: (message: string) => Promise<{ ok: boolean }>
    }
  }
}
