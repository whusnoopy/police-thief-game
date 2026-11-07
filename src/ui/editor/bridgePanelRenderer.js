import { getMapDimensions } from "../../domain/map/mapDimensions.js";
import { getBridgeWarnings, getRampConnectionIssues } from "../../domain/map/bridgeTopology.js";
import { usesRampRules } from "../../domain/map/mapCompatibility.js";
import { decodeMapDefinition } from "../../domain/map/mapCodec.js";
import { getLegacyBridgeContacts } from "../../domain/map/mapUpgrade.js";

const positionLabel = ({ r, c }) => `第 ${r + 1} 行第 ${c + 1} 列`;

export function renderBridgePanel(container, { mapDefinition, onUpgrade, onComplete, onInspect }) {
  if (!container) return;
  container.innerHTML = "";
  const isNew = usesRampRules(mapDefinition);
  const status = document.createElement("p");
  status.className = "bridge-status";
  status.setAttribute("role", "status");
  status.textContent = isNew
    ? mapDefinition.upgrade && mapDefinition.upgrade.status !== "ready"
      ? "升级中：调整上下桥入口后，校验并完成升级。原图已保留。"
      : `${mapDefinition.upgrade ? "升级已完成。" : ""}高架通过上下桥格连接地面；箭头朝高端，反向可下桥，两侧封闭。预览绿边相接、红边封闭。`
    : "旧规则地图：创建升级副本后可使用上下桥格，原图会保留。含旧高架的地图须先升级才能游玩。";
  container.appendChild(status);

  function action(id, label, handler) {
    const button = document.createElement("button");
    button.id = id;
    button.type = "button";
    button.className = "btn secondary";
    button.textContent = label;
    button.addEventListener("click", handler);
    container.appendChild(button);
  }
  if (!isNew) action("btn-upgrade-map", "创建升级副本", onUpgrade);
  if (mapDefinition.upgrade && mapDefinition.upgrade.status !== "ready") action("btn-finish-upgrade", "校验并完成升级", onComplete);

  function locationList(title, items, open = false) {
    if (!items.length) return;
    const details = document.createElement("details");
    details.className = "bridge-feedback";
    details.open = open;
    const summary = document.createElement("summary");
    summary.textContent = `${title}（${items.length}）`;
    const list = document.createElement("div");
    list.className = "bridge-feedback-list";
    items.forEach(({ position, label }) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "bridge-location";
      button.textContent = `${positionLabel(position)}：${label}`;
      button.addEventListener("click", () => onInspect(position));
      list.appendChild(button);
    });
    details.append(summary, list);
    container.appendChild(details);
  }

  if (isNew) {
    locationList("坡道待调整", getRampConnectionIssues(mapDefinition).map((issue) => ({
      position: issue,
      label: issue.reason === "RAMP_HIGH_END" ? "高端需连接普通高架" : "低端需连接可驾车陆地",
    })), true);
    locationList("高架提示", getBridgeWarnings(mapDefinition).map((issue) => ({ position: issue, label: "这片高架没有有效上下桥入口，不能从地面驶入" })));
  }
  if (mapDefinition.upgrade) {
    const source = decodeMapDefinition(mapDefinition.upgrade.source.encodedMap);
    const names = { N: "北", E: "东", S: "南", W: "西" };
    locationList("原图入口参考", getLegacyBridgeContacts(source).map(({ bridge, direction }) => ({
      position: getMapDimensions(source).rows === 10 && getMapDimensions(mapDefinition).rows === 20 ? { r: bridge.r + 5, c: bridge.c + 5 } : bridge, label: `原来连接${names[direction]}侧地面；新版仅通过坡道联通`,
    })));
  }
}
