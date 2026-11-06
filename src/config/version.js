import packageInfo from "../../package.json" with { type: "json" };

export const APP_VERSION = packageInfo.version;
export const APP_VERSION_LABEL = `${APP_VERSION.split(".")[1] === "0" ? "测试版 " : "版本 "}${APP_VERSION}`;
