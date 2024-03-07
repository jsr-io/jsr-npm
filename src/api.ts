import { JsrPackage } from "./utils";

export const JSR_URL = process.env.JSR_URL ?? "https://jsr.io";

export interface PackageMeta {
  scope: string;
  name: string;
  latest?: string;
  description?: string;
  versions: Record<string, {}>;
}

export async function getPackageMeta(pkg: JsrPackage): Promise<PackageMeta> {
  const url = `${JSR_URL}/@${pkg.scope}/${pkg.name}/meta.json`;
  const res = await fetch(url);
  if (!res.ok) {
    // cancel unconsumed body to avoid memory leak
    await res.body?.cancel();
    throw new Error(`Received ${res.status} from ${url}`);
  }

  return (await res.json()) as PackageMeta;
}

export async function getLatestPackageVersion(
  pkg: JsrPackage,
): Promise<string> {
  const info = await getPackageMeta(pkg);
  const { latest } = info;
  if (latest === undefined) {
    throw new Error(`Unable to find latest version of ${pkg}`);
  }
  return latest;
}

export interface NpmPackageInfo {
  name: string;
  description: string;
  "dist-tags": { latest: string };
  versions: Record<string, {
    name: string;
    version: string;
    description: string;
    dist: {
      tarball: string;
      shasum: string;
      integrity: string;
    };
    dependencies: Record<string, string>;
  }>;
  time: {
    created: string;
    modified: string;
    [key: string]: string;
  };
}

export async function getNpmPackageInfo(
  pkg: JsrPackage,
): Promise<NpmPackageInfo> {
  const tmpUrl = new URL(`${JSR_URL}/@jsr/${pkg.scope}__${pkg.name}`);
  const url = `${tmpUrl.protocol}//npm.${tmpUrl.host}${tmpUrl.pathname}`;
  const res = await fetch(url);
  if (!res.ok) {
    // Cancel unconsumed body to avoid memory leak
    await res.body?.cancel();
    throw new Error(`Received ${res.status} from ${tmpUrl}`);
  }
  const json = await res.json();
  return json as NpmPackageInfo;
}
