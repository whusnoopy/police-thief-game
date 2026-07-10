const DEFAULT_ELEMENT_IDS = [
  "editor-view",
  "game-view",
  "map-list-view",
  "editor-board",
  "game-board",
  "palette",
  "mode-indicator",
  "btn-clear-map",
  "btn-start-game",
  "editor-help-wrapper",
  "btn-editor-help",
  "editor-help-tooltip",
  "btn-back-editor",
  "turn-indicator",
  "signal-indicator",
  "police-stat",
  "thief-stat",
  "dice",
  "dice-value",
  "game-message",
  "btn-roll-dice",
  "btn-skip-turn",
  "btn-view-rules",
  "rules-modal",
  "btn-close-rules-modal",
  "btn-close-rules-modal-footer",
  "victory-modal",
  "victory-title",
  "victory-message",
  "btn-play-again",
  "btn-modal-editor",
  "btn-map-list",
  "btn-back-from-list",
  "btn-create-map",
  "map-list-grid",
  "map-list-empty",
  "share-link-modal",
  "share-link-message",
  "share-link-input",
  "btn-copy-share-link",
  "btn-close-share-link-modal",
];

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

class FakeClassList {
  constructor(element) {
    this.element = element;
  }

  getSet() {
    return new Set(String(this.element.className || "").split(/\s+/).filter(Boolean));
  }

  commit(set) {
    this.element.className = Array.from(set).join(" ");
  }

  add(...tokens) {
    const next = this.getSet();
    tokens.forEach((token) => next.add(token));
    this.commit(next);
  }

  remove(...tokens) {
    const next = this.getSet();
    tokens.forEach((token) => next.delete(token));
    this.commit(next);
  }

  toggle(token, force) {
    const next = this.getSet();
    const shouldAdd = force ?? !next.has(token);
    if (shouldAdd) next.add(token);
    else next.delete(token);
    this.commit(next);
    return shouldAdd;
  }

  contains(token) {
    return this.getSet().has(token);
  }
}

class FakeTextNode {
  constructor(text, ownerDocument) {
    this.nodeType = 3;
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.textContent = String(text);
  }

  cloneNode() {
    return new FakeTextNode(this.textContent, this.ownerDocument);
  }
}

class FakeElement {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.parentNode = null;
    this.children = [];
    this.dataset = {};
    this.style = {};
    this.attributes = {};
    this.listeners = new Map();
    this.className = "";
    this.disabled = false;
    this.value = "";
    this.title = "";
    this.onclick = null;
    this._id = "";
    this._textContent = "";
    this._innerHTML = "";
    this.classList = new FakeClassList(this);
  }

  get id() {
    return this._id;
  }

  set id(value) {
    const nextId = String(value || "");
    if (this._id) {
      this.ownerDocument.unregisterId(this._id, this);
    }
    this._id = nextId;
    if (nextId) {
      this.ownerDocument.registerElement(this);
    }
  }

  get textContent() {
    if (this.children.length > 0) {
      return this.children
        .map((child) => (child.nodeType === 3 ? child.textContent : child.textContent))
        .join("");
    }
    return this._textContent;
  }

  set textContent(value) {
    this.children.forEach((child) => this.ownerDocument.unregisterTree(child));
    this.children = [];
    this._innerHTML = "";
    this._textContent = String(value);
  }

  get innerHTML() {
    if (this.children.length > 0) {
      return this.children
        .map((child) => {
          if (child.nodeType === 3) return escapeHtml(child.textContent);
          return child.outerHTML;
        })
        .join("");
    }
    if (this._innerHTML) return this._innerHTML;
    return escapeHtml(this._textContent);
  }

  set innerHTML(value) {
    this.children.forEach((child) => this.ownerDocument.unregisterTree(child));
    this.children = [];
    this._textContent = "";
    this._innerHTML = String(value);
  }

  get outerHTML() {
    return `<${this.tagName.toLowerCase()}>${this.innerHTML}</${this.tagName.toLowerCase()}>`;
  }

  appendChild(child) {
    const nextChild =
      typeof child === "string" ? this.ownerDocument.createTextNode(child) : child;

    if (nextChild.parentNode) {
      nextChild.parentNode.removeChild(nextChild);
    }

    this._innerHTML = "";
    this._textContent = "";
    nextChild.parentNode = this;
    this.children.push(nextChild);
    if (nextChild.nodeType !== 3) {
      this.ownerDocument.registerTree(nextChild);
    }
    return nextChild;
  }

  append(...children) {
    children.forEach((child) => this.appendChild(child));
  }

  removeChild(child) {
    const index = this.children.indexOf(child);
    if (index === -1) return child;

    this.children.splice(index, 1);
    if (child.nodeType !== 3) {
      this.ownerDocument.unregisterTree(child);
    }
    child.parentNode = null;
    return child;
  }

  contains(node) {
    if (node === this) return true;
    return this.children.some(
      (child) => child.nodeType !== 3 && typeof child.contains === "function" && child.contains(node),
    );
  }

  replaceChild(newChild, oldChild) {
    const index = this.children.indexOf(oldChild);
    if (index === -1) return oldChild;

    if (newChild.parentNode) {
      newChild.parentNode.removeChild(newChild);
    }

    if (oldChild.nodeType !== 3) {
      this.ownerDocument.unregisterTree(oldChild);
    }

    this.children[index] = newChild;
    newChild.parentNode = this;
    if (newChild.nodeType !== 3) {
      this.ownerDocument.registerTree(newChild);
    }
    oldChild.parentNode = null;
    return oldChild;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    const nextEvent = event || { type: "" };
    nextEvent.target ||= this;
    nextEvent.currentTarget = this;
    nextEvent.preventDefault ||= () => {};
    nextEvent.stopPropagation ||= () => {};

    const listeners = this.listeners.get(nextEvent.type) || [];
    listeners.forEach((listener) => listener(nextEvent));

    if (nextEvent.type === "click" && typeof this.onclick === "function") {
      this.onclick(nextEvent);
    }

    return true;
  }

  click() {
    this.dispatchEvent({ type: "click" });
  }

  focus() {}

  select() {}

  setAttribute(name, value) {
    if (name === "id") {
      this.id = value;
      return;
    }
    if (name === "class") {
      this.className = String(value);
      return;
    }
    this.attributes[name] = String(value);
  }

  removeAttribute(name) {
    if (name === "id") {
      this.id = "";
      return;
    }
    delete this.attributes[name];
  }

  cloneNode() {
    const clone = new FakeElement(this.tagName, this.ownerDocument);
    clone.className = this.className;
    clone.disabled = this.disabled;
    clone.value = this.value;
    clone.title = this.title;
    clone._textContent = this._textContent;
    clone._innerHTML = this._innerHTML;
    clone.dataset = { ...this.dataset };
    clone.style = { ...this.style };
    clone.attributes = { ...this.attributes };
    return clone;
  }

  querySelectorAll(selector) {
    return this.ownerDocument.querySelectorAll(selector, this);
  }
}

class FakeDocument {
  constructor() {
    this.readyState = "complete";
    this.body = new FakeElement("body", this);
    this.listeners = new Map();
    this.idMap = new Map();
  }

  createElement(tagName) {
    return new FakeElement(tagName, this);
  }

  createTextNode(text) {
    return new FakeTextNode(text, this);
  }

  getElementById(id) {
    return this.idMap.get(id) || null;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  dispatchEvent(event) {
    const listeners = this.listeners.get(event.type) || [];
    listeners.forEach((listener) => listener(event));
  }

  querySelectorAll(selector, root = this.body) {
    const results = [];
    const matcher = createSelectorMatcher(selector);

    const visit = (node) => {
      if (!node || node.nodeType === 3) return;
      if (node !== root && matcher(node)) {
        results.push(node);
      }
      node.children.forEach((child) => visit(child));
    };

    if (matcher(root)) {
      results.push(root);
    }
    root.children.forEach((child) => visit(child));
    return results;
  }

  execCommand(command) {
    return command === "copy";
  }

  registerElement(element) {
    if (element.id) {
      this.idMap.set(element.id, element);
    }
  }

  unregisterId(id, element) {
    if (this.idMap.get(id) === element) {
      this.idMap.delete(id);
    }
  }

  registerTree(element) {
    if (!element || element.nodeType === 3) return;
    this.registerElement(element);
    element.children.forEach((child) => this.registerTree(child));
  }

  unregisterTree(element) {
    if (!element || element.nodeType === 3) return;
    this.unregisterId(element.id, element);
    element.children.forEach((child) => this.unregisterTree(child));
  }
}

function createSelectorMatcher(selector) {
  if (selector.startsWith(".")) {
    const className = selector.slice(1);
    return (element) => element.classList.contains(className);
  }

  if (selector.startsWith("#")) {
    const id = selector.slice(1);
    return (element) => element.id === id;
  }

  const tagName = selector.toUpperCase();
  return (element) => element.tagName === tagName;
}

function getTagNameForId(id) {
  if (id.startsWith("btn-")) return "button";
  if (id.endsWith("-input")) return "input";
  return "div";
}

function createStorage() {
  const data = new Map();
  return {
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(key, String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
  };
}

function installGlobalProperty(name, value) {
  Object.defineProperty(globalThis, name, {
    value,
    configurable: true,
    writable: true,
  });
}

export function createTestEnvironment({ search = "" } = {}) {
  const document = new FakeDocument();
  const elements = {};

  DEFAULT_ELEMENT_IDS.forEach((id) => {
    const element = document.createElement(getTagNameForId(id));
    element.id = id;
    document.body.appendChild(element);
    elements[id] = element;
  });

  const localStorage = createStorage();
  const alerts = [];
  const promptResponses = [];
  const confirms = [];

  const location = {
    protocol: "https:",
    host: "example.com",
    pathname: "/police/",
    search,
  };
  const history = {
    replaceState(_state, _title, url) {
      const parsed = new URL(url, `${location.protocol}//${location.host}`);
      location.pathname = parsed.pathname;
      location.search = parsed.search;
    },
  };
  const window = {
    document,
    history,
    location,
  };

  return {
    alerts,
    confirms,
    document,
    elements,
    localStorage,
    window,
    installGlobals() {
      installGlobalProperty("document", document);
      installGlobalProperty("window", window);
      installGlobalProperty("localStorage", localStorage);
      installGlobalProperty("navigator", { clipboard: { writeText: () => Promise.resolve() } });
      installGlobalProperty("alert", (message) => {
        alerts.push(message);
      });
      installGlobalProperty("confirm", (message) => {
        confirms.push(message);
        return true;
      });
      installGlobalProperty("prompt", () =>
        promptResponses.length > 0 ? promptResponses.shift() : null,
      );
    },
    setPromptResponses(responses) {
      promptResponses.splice(0, promptResponses.length, ...responses);
    },
  };
}
