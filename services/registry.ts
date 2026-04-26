import type { ServicePlugin, ServiceType } from "@/services/types";

const registry = new Map<ServiceType, ServicePlugin>();

export function registerPlugin(plugin: ServicePlugin): void {
  registry.set(plugin.type, plugin);
}

export function getPlugin(type: ServiceType): ServicePlugin | undefined {
  return registry.get(type);
}

export function getAllPlugins(): ServicePlugin[] {
  return Array.from(registry.values());
}

export function getPluginTypes(): ServiceType[] {
  return Array.from(registry.keys());
}
