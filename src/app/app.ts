import { Component, OnInit, signal } from '@angular/core';

type ContainerItem = {
  id: string;
  name: string;
  image: string;
  status: string;
  ports: string;
  compose: string;
  composeDir?: string;
};

type ContainerGroup = {
  id: string;
  name: string;
  status: string;
  containers: ContainerItem[];
  collapsed: boolean;
  composeDir?: string;
};

type AssetItem = {
  id: string;
  name: string;
  size: string;
  updatedAt: string;
};

type DockerResult = {
  ok: boolean;
  data?: any[];
  error?: string;
};

type DockerActionResult = {
  ok: boolean;
  error?: string;
};

type DockerInspectResult = {
  ok: boolean;
  data?: any;
  error?: string;
};

type DockerLogsResult = {
  ok: boolean;
  data?: string;
  error?: string;
};

@Component({
  selector: 'app-root',
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('container-manager');
  protected readonly containers = signal<any[]>([]);
  protected readonly error = signal<string | null>(null);
  protected readonly loading = signal(true);
  protected readonly selectedLog = signal<string>('');
  protected readonly selectedLogTitle = signal('ログを表示するコンテナを選択してください。');
  protected readonly showInspectModal = signal(false);
  protected readonly inspectTitle = signal('');
  protected readonly inspectRows = signal<Array<{ key: string; value: string }>>([]);
  protected readonly showLogModal = signal(false);

  protected readonly groups = signal<ContainerGroup[]>([]);
  protected readonly volumes = signal<AssetItem[]>([]);
  protected readonly images = signal<AssetItem[]>([]);


  async ngOnInit() {
    await this.refreshAll()
  }

  protected clearLog() {
    this.selectedLog.set('');
    this.selectedLogTitle.set('ログを表示するコンテナを選択してください。');
  }

  protected closeLogModal() {
    this.showLogModal.set(false)
  }

  protected async refreshAll() {
    this.loading.set(true)
    this.error.set(null)

    if (!window.dockerApi?.listContainers || !window.dockerApi?.listVolumes || !window.dockerApi?.listImages) {
      const message = 'Electron API が見つかりませんでした。'
      this.error.set(message)
      this.openErrorWindow(message)
      this.loading.set(false)
      return
    }

    const [containersResult, volumesResult, imagesResult] = await Promise.all([
      window.dockerApi.listContainers(),
      window.dockerApi.listVolumes(),
      window.dockerApi.listImages()
    ])

    this.applyContainerResult(containersResult)
    this.applyVolumeResult(volumesResult)
    this.applyImageResult(imagesResult)

    const errors = [containersResult, volumesResult, imagesResult]
      .filter((result) => !result.ok)
      .map((result) => result.error ?? 'unknown error')

    if (errors.length > 0) {
      const message = errors.join('\n')
      this.error.set(message)
      this.openErrorWindow(message)
    }

    this.loading.set(false)
  }

  protected async startAll() {
    for (const group of this.groups()) {
      await this.startGroup(group);
    }
  }

  protected async stopAll() {
    for (const group of this.groups()) {
      await this.stopGroup(group);
    }
  }

  protected async removeAll() {
    const confirmed = this.confirmAction('全てのコンテナを削除しますか？')
    if (!confirmed) {
      return
    }
    for (const group of this.groups()) {
      await this.removeGroup(group);
    }
  }

  protected async startGroup(group: ContainerGroup) {
    for (const container of group.containers) {
      if (!this.isRunning(container.status)) {
        await this.startContainer(container, false);
      }
    }
    await this.refreshContainers();
  }

  protected async stopGroup(group: ContainerGroup) {
    for (const container of group.containers) {
      if (this.isRunning(container.status)) {
        await this.stopContainer(container, false);
      }
    }
    await this.refreshContainers();
  }

  protected async removeGroup(group: ContainerGroup) {
    const confirmed = this.confirmAction(`Compose ${group.name} を削除しますか？`)
    if (!confirmed) {
      return
    }
    for (const container of group.containers) {
      await this.removeContainer(container, false);
    }
    await this.refreshContainers();
  }

  protected async startContainer(container: ContainerItem, shouldRefresh = true) {
    const result = await this.invokeDockerAction(
      window.dockerApi?.startContainer(container.id)
    );
    if (!result.ok) {
      this.openErrorWindow(result.error ?? 'docker start に失敗しました。');
      return;
    }
    if (shouldRefresh) {
      await this.refreshContainers();
    }
  }

  protected async stopContainer(container: ContainerItem, shouldRefresh = true) {
    const result = await this.invokeDockerAction(
      window.dockerApi?.stopContainer(container.id)
    );
    if (!result.ok) {
      this.openErrorWindow(result.error ?? 'docker stop に失敗しました。');
      return;
    }
    if (shouldRefresh) {
      await this.refreshContainers();
    }
  }

  protected async removeContainer(container: ContainerItem, shouldRefresh = true) {
    const confirmed = this.confirmAction(`${container.name} を削除しますか？`)
    if (!confirmed) {
      return
    }
    const result = await this.invokeDockerAction(
      window.dockerApi?.removeContainer(container.id)
    );
    if (!result.ok) {
      this.openErrorWindow(result.error ?? 'docker rm に失敗しました。');
      return;
    }
    if (shouldRefresh) {
      await this.refreshContainers();
    }
  }

  protected async showLog(container: ContainerItem) {
    this.selectedLogTitle.set(`${container.name} のログ`);
    const result = await this.invokeDockerLogs(
      window.dockerApi?.logsContainer(container.id)
    );
    if (!result.ok) {
      this.selectedLog.set('');
      this.openErrorWindow(result.error ?? 'docker logs に失敗しました。');
      return;
    }
    this.selectedLog.set(result.data ?? '');
    this.showLogModal.set(true)
  }

  protected async showInspect(container: ContainerItem) {
    this.selectedLogTitle.set(`${container.name} の inspect`);
    const result = await this.invokeDockerInspect(
      window.dockerApi?.inspectContainer(container.id)
    );
    if (!result.ok) {
      this.selectedLog.set('');
      this.openErrorWindow(result.error ?? 'docker inspect に失敗しました。');
      return;
    }
    this.selectedLog.set(JSON.stringify(result.data ?? {}, null, 2));
  }

  protected async showComposeLogs(group: ContainerGroup) {
    this.selectedLogTitle.set(`${group.name} の compose logs`)
    const result = await this.invokeDockerLogs(
      window.dockerApi?.composeLogs(group.name)
    )
    if (!result.ok) {
      this.selectedLog.set('')
      this.openErrorWindow(result.error ?? 'docker compose logs に失敗しました。')
      return
    }
    this.selectedLog.set(result.data ?? '')
    this.showLogModal.set(true)
  }

  protected async openComposeDirectory(group: ContainerGroup) {
    if (!group.composeDir) {
      this.openErrorWindow('Compose ディレクトリが見つかりませんでした。')
      return
    }
    const result = await this.invokeDockerAction(
      window.dockerApi?.openInVSCode(group.composeDir)
    )
    if (!result.ok) {
      this.openErrorWindow(result.error ?? 'VSCode で開くことに失敗しました。')
    }
  }

  protected async showComposeInspect(group: ContainerGroup) {
    this.inspectTitle.set(`${group.name} の compose inspect`)
    if (!group.composeDir) {
      this.openErrorWindow('Compose ディレクトリが見つかりませんでした。')
      return
    }
    const result = await this.invokeDockerInspect(
      window.dockerApi?.composeInspect(group.name, group.composeDir)
    )
    if (!result.ok) {
      this.openErrorWindow(result.error ?? 'docker compose inspect に失敗しました。')
      return
    }
    this.openInspectModal(result.data)
  }

  protected async removeVolume(volume: AssetItem) {
    const confirmed = this.confirmAction(`${volume.name} を削除しますか？`)
    if (!confirmed) {
      return
    }
    const result = await this.invokeDockerAction(
      window.dockerApi?.removeVolume(volume.name)
    );
    if (!result.ok) {
      this.openErrorWindow(result.error ?? 'docker volume rm に失敗しました。');
      return;
    }
    await this.refreshVolumes();
  }

  protected async showVolumeInspect(volume: AssetItem) {
    this.inspectTitle.set(`${volume.name} の volume inspect`)
    const result = await this.invokeDockerInspect(
      window.dockerApi?.inspectVolume(volume.name)
    )
    if (!result.ok) {
      this.openErrorWindow(result.error ?? 'docker volume inspect に失敗しました。')
      return
    }
    this.openInspectModal(result.data)
  }

  protected async removeImage(image: AssetItem) {
    const confirmed = this.confirmAction(`${image.name} を削除しますか？`)
    if (!confirmed) {
      return
    }
    const result = await this.invokeDockerAction(
      window.dockerApi?.removeImage(image.name)
    );
    if (!result.ok) {
      this.openErrorWindow(result.error ?? 'docker rmi に失敗しました。');
      return;
    }
    await this.refreshImages();
  }

  protected async showImageInspect(image: AssetItem) {
    this.inspectTitle.set(`${image.name} の image inspect`)
    const result = await this.invokeDockerInspect(
      window.dockerApi?.inspectImage(image.name)
    )
    if (!result.ok) {
      this.openErrorWindow(result.error ?? 'docker image inspect に失敗しました。')
      return
    }
    this.openInspectModal(result.data)
  }

  protected toggleGroup(group: ContainerGroup) {
    this.groups.update((current) =>
      current.map((item) =>
        item.id === group.id ? { ...item, collapsed: !item.collapsed } : item
      )
    )
  }

  protected async removeAllVolumes() {
    const confirmed = this.confirmAction('全ての Volume を削除しますか？')
    if (!confirmed) {
      return
    }
    for (const volume of this.volumes()) {
      await this.removeVolume(volume);
    }
  }

  protected async removeAllImages() {
    const confirmed = this.confirmAction('全ての Image を削除しますか？')
    if (!confirmed) {
      return
    }
    for (const image of this.images()) {
      await this.removeImage(image);
    }
  }

  protected async refreshContainers() {
    if (!window.dockerApi?.listContainers) {
      this.openErrorWindow('Electron API が見つかりませんでした。')
      return
    }
    const result = await window.dockerApi.listContainers()
    this.applyContainerResult(result)
    if (!result.ok) {
      this.openErrorWindow(result.error ?? 'docker ps に失敗しました。')
    }
  }

  protected async refreshVolumes() {
    if (!window.dockerApi?.listVolumes) {
      this.openErrorWindow('Electron API が見つかりませんでした。')
      return
    }
    const result = await window.dockerApi.listVolumes()
    this.applyVolumeResult(result)
    if (!result.ok) {
      this.openErrorWindow(result.error ?? 'docker volume ls に失敗しました。')
    }
  }

  protected async refreshImages() {
    if (!window.dockerApi?.listImages) {
      this.openErrorWindow('Electron API が見つかりませんでした。')
      return
    }
    const result = await window.dockerApi.listImages()
    this.applyImageResult(result)
    if (!result.ok) {
      this.openErrorWindow(result.error ?? 'docker images に失敗しました。')
    }
  }

  private applyContainerResult(result: DockerResult) {
    if (!result.ok) {
      this.containers.set([])
      this.groups.set([])
      return
    }
    const data = result.data ?? []
    this.containers.set(data)
    if (data.length === 0) {
      this.groups.set([])
      return
    }
    const grouped = data.reduce((acc: Map<string, ContainerItem[]>, item) => {
      const name = String(item.Names ?? 'unknown')
      const image = String(item.Image ?? 'unknown')
      const status = String(item.Status ?? 'unknown')
      const ports = String(item.Ports ?? '—')
      const labels = this.parseLabels(item.Labels)
      const compose = String(item.Compose ?? labels['com.docker.compose.project'] ?? 'ungrouped')
      const entry: ContainerItem = {
        id: String(item.ID ?? name),
        name,
        image,
        status,
        ports,
        compose,
        composeDir: labels['com.docker.compose.project.working_dir']
      }
      const list = acc.get(compose) ?? []
      list.push(entry)
      acc.set(compose, list)
      return acc
    }, new Map())

    const entries = Array.from(grouped.entries()) as Array<[string, ContainerItem[]]>
    const groups: ContainerGroup[] = entries.map(([compose, items]) => ({
      id: compose,
      name: compose,
      status: `稼働中 ${items.filter((item) => this.isRunning(item.status)).length} / 停止 ${
        items.filter((item) => !this.isRunning(item.status)).length
      }`,
      containers: this.sortContainers(items),
      collapsed: true,
      composeDir: items.find((item) => item.composeDir)?.composeDir
    }))

    this.groups.set(groups)
  }

  private applyVolumeResult(result: DockerResult) {
    if (!result.ok) {
      this.volumes.set([])
      return
    }
    const data = result.data ?? []
    const volumes = data.map((item) => ({
      id: String(item.Name ?? item.ID ?? item?.name ?? Math.random()),
      name: String(item.Name ?? item?.name ?? 'unknown'),
      size: String(item.Size ?? '—'),
      updatedAt: String(item.CreatedAt ?? item?.CreatedAt ?? '—')
    }))
    this.volumes.set(volumes)
  }

  private applyImageResult(result: DockerResult) {
    if (!result.ok) {
      this.images.set([])
      return
    }
    const data = result.data ?? []
    const images = data.map((item) => ({
      id: String(item.ID ?? item?.Id ?? Math.random()),
      name: `${item.Repository ?? 'unknown'}:${item.Tag ?? 'latest'}`,
      size: String(item.Size ?? '—'),
      updatedAt: String(item.CreatedSince ?? item.CreatedAt ?? '—')
    }))
    this.images.set(images)
  }

  private async invokeDockerAction(
    action?: Promise<DockerActionResult>
  ): Promise<DockerActionResult> {
    if (!action) {
      return { ok: false, error: 'Electron API が見つかりませんでした。' };
    }
    try {
      return await action;
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  private async invokeDockerInspect(
    action?: Promise<DockerInspectResult>
  ): Promise<DockerInspectResult> {
    if (!action) {
      return { ok: false, error: 'Electron API が見つかりませんでした。' };
    }
    try {
      return await action;
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  private async invokeDockerLogs(
    action?: Promise<DockerLogsResult>
  ): Promise<DockerLogsResult> {
    if (!action) {
      return { ok: false, error: 'Electron API が見つかりませんでした。' };
    }
    try {
      return await action;
    } catch (error) {
      return { ok: false, error: String(error) };
    }
  }

  private isRunning(status: string) {
    return /up/i.test(status)
  }

  private parseLabels(labels: unknown): Record<string, string> {
    if (!labels) {
      return {}
    }
    if (typeof labels === 'object') {
      return labels as Record<string, string>
    }
    if (typeof labels !== 'string') {
      return {}
    }
    return labels.split(',').reduce((acc: Record<string, string>, part) => {
      const [rawKey, ...rest] = part.split('=')
      const key = rawKey?.trim()
      if (!key) {
        return acc
      }
      acc[key] = rest.join('=').trim()
      return acc
    }, {})
  }

  private sortContainers(items: ContainerItem[]) {
    return [...items].sort((a, b) => {
      const runningDelta = Number(this.isRunning(b.status)) - Number(this.isRunning(a.status))
      if (runningDelta !== 0) {
        return runningDelta
      }
      return a.name.localeCompare(b.name)
    })
  }

  private openErrorWindow(message: string) {
    if (window.dockerApi?.openErrorWindow) {
      window.dockerApi.openErrorWindow(message)
      return
    }
    this.error.set(message)
  }

  private openInspectModal(data: any) {
    const rows = this.flattenInspect(data)
    this.inspectRows.set(rows)
    this.showInspectModal.set(true)
  }

  protected closeInspectModal() {
    this.showInspectModal.set(false)
  }

  private flattenInspect(data: any, prefix = ''): Array<{ key: string; value: string }> {
    if (data === null || data === undefined) {
      return [{ key: prefix || 'value', value: String(data) }]
    }
    if (Array.isArray(data)) {
      return data.flatMap((item, index) => this.flattenInspect(item, `${prefix}[${index}]`))
    }
    if (typeof data === 'object') {
      return Object.entries(data).flatMap(([key, value]) =>
        this.flattenInspect(value, prefix ? `${prefix}.${key}` : key)
      )
    }
    return [{ key: prefix || 'value', value: String(data) }]
  }

  private confirmAction(message: string) {
    return window.confirm(message)
  }
}
