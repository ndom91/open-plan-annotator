import { describe, expect, mock, test } from "bun:test";
import { downloadVerifiedArchive, getReleaseApiUrl, resolveReleaseAssetAndChecksum, VERSION } from "./install.mjs";

describe("install checksum enforcement", () => {
  test("does not retry unverified download when checksum verification fails", async () => {
    const fetchMock = mock(async () => Buffer.from("tampered archive"));

    await expect(
      downloadVerifiedArchive({
        fetch: fetchMock,
        resolveReleaseAssetAndChecksum: async () => ({
          assetName: "open-plan-annotator-darwin-arm64.tar.gz",
          assetUrl: "https://example.com/asset.tgz",
          expectedSha256: "0".repeat(64),
        }),
      }),
    ).rejects.toThrow("requires release checksum/sha256sum availability");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith("https://example.com/asset.tgz");
  });

  test("fails with checksum requirement message when checksum manifest is missing", async () => {
    await expect(
      downloadVerifiedArchive({
        resolveReleaseAssetAndChecksum: async () => {
          throw new Error("Release v1.2.3 does not contain a checksum manifest asset");
        },
      }),
    ).rejects.toThrow(
      "Unable to verify release checksums: Release v1.2.3 does not contain a checksum manifest asset open-plan-annotator requires release checksum/sha256sum availability and will not install without verification.",
    );
  });

  test("fails closed when checksum manifest fetch errors during resolution", async () => {
    const urls: string[] = [];
    const fetchJsonMock = mock(async (url: string) => {
      urls.push(url);
      return {
        assets: [
          {
            name: "open-plan-annotator-darwin-arm64.tar.gz",
            browser_download_url: "https://example.com/open-plan-annotator-darwin-arm64.tar.gz",
          },
          {
            name: "sha256sums.txt",
            browser_download_url: "https://example.com/sha256sums.txt",
          },
        ],
      };
    });

    const fetchMock = mock(async (url: string) => {
      urls.push(url);
      throw new Error("HTTP 404 from https://example.com/sha256sums.txt");
    });

    await expect(
      downloadVerifiedArchive({
        fetch: fetchMock,
        resolveReleaseAssetAndChecksum: () =>
          resolveReleaseAssetAndChecksum({
            fetch: fetchMock,
            fetchJson: fetchJsonMock,
            platformKey: "darwin-arm64",
            version: VERSION,
            releaseApiUrl: getReleaseApiUrl(),
          }),
      }),
    ).rejects.toThrow("requires release checksum/sha256sum availability");

    expect(urls).toEqual([getReleaseApiUrl(), "https://example.com/sha256sums.txt"]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
