"use strict";

const TASKS_STORAGE_KEY = "focusly.tasks";
const TASKS_BACKUP_KEY = "focusly.tasks.backup.v1";
const NAME_STORAGE_KEY = "focusly.userName";
const VALID_STATUSES = new Set(["pending", "accepted", "in_progress", "completed"]);
const VALID_PRIORITIES = new Set(["low", "medium", "high", "urgent"]);
const STATUS_LABELS = {
  pending: "Chờ nhận",
  accepted: "Đã nhận",
  in_progress: "Đang thực hiện",
  completed: "Hoàn thành"
};
const PRIORITY_LABELS = {
  low: "Thấp",
  medium: "Trung bình",
  high: "Cao",
  urgent: "Khẩn cấp"
};

const $ = (selector, parent = document) => parent.querySelector(selector);
const taskForm = $("#task-form");
const taskList = $("#task-list");
const statusMessage = $("#status-message");
const taskDialog = $("#task-dialog");
const acceptDialog = $("#accept-dialog");
const detailDialog = $("#detail-dialog");
const confirmDialog = $("#confirm-dialog");
const nameDialog = $("#name-dialog");

let currentFilter = "all";
let currentNavView = "dashboard";
let currentPriority = "all";
let editingTaskId = null;
let activeTaskId = null;
let confirmResolver = null;
let statusTimeout;
let storageWriteBlocked = false;
let userName = loadUserName();
let tasks = loadTasks();

function showStatus(message, kind = "info") {
  statusMessage.textContent = message;
  statusMessage.dataset.kind = kind;
  statusMessage.hidden = false;
  window.clearTimeout(statusTimeout);
  statusTimeout = window.setTimeout(() => {
    statusMessage.hidden = true;
  }, 6500);
}

function createTaskId() {
  if (window.crypto && typeof window.crypto.randomUUID === "function") {
    return window.crypto.randomUUID();
  }
  return `task-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function loadUserName() {
  try {
    return window.localStorage.getItem(NAME_STORAGE_KEY)?.trim() || "";
  } catch {
    showStatus("Không thể đọc tên đã lưu. Bạn vẫn có thể dùng các chức năng công việc.", "error");
    return "";
  }
}

function isValidDate(value) {
  return typeof value === "string" && value.length > 0 && Number.isFinite(Date.parse(value));
}

function preserveRawTaskData(rawValue) {
  if (typeof rawValue !== "string") return false;
  try {
    const recoveryKey = "focusly.tasks.recovery.v1";
    const existingRecovery = window.localStorage.getItem(recoveryKey);
    if (existingRecovery === rawValue) return true;
    window.localStorage.setItem(
      existingRecovery === null ? recoveryKey : `focusly.tasks.recovery.${Date.now()}`,
      rawValue
    );
    return true;
  } catch {
    storageWriteBlocked = true;
    return false;
  }
}

function normalizeTask(task, usedIds) {
  if (!task || typeof task !== "object") return null;

  const title = typeof task.title === "string" ? task.title.trim()
    : typeof task.text === "string" ? task.text.trim() : "";
  if (!title) return null;

  let id = typeof task.id === "string" && task.id.trim() ? task.id : createTaskId();
  if (usedIds.has(id)) id = createTaskId();
  usedIds.add(id);

  const assignedTo = typeof task.assignedTo === "string" && task.assignedTo.trim()
    ? task.assignedTo.trim()
    : null;
  const requestedStatus = typeof task.status === "string" && VALID_STATUSES.has(task.status)
    ? task.status
    : null;
  const completed = task.completed === true || requestedStatus === "completed";
  const status = completed
    ? "completed"
    : assignedTo && requestedStatus && requestedStatus !== "pending"
      ? requestedStatus
      : assignedTo
        ? "accepted"
        : "pending";

  return {
    id,
    title,
    assignedBy: typeof task.assignedBy === "string" && task.assignedBy.trim()
      ? task.assignedBy.trim()
      : "Chưa ghi nhận",
    assignedTo: status === "pending" ? null : assignedTo,
    description: typeof task.description === "string" ? task.description : "",
    createdAt: isValidDate(task.createdAt) ? task.createdAt : null,
    deadline: isValidDate(task.deadline) ? task.deadline : null,
    acceptedAt: status === "pending" || !isValidDate(task.acceptedAt) ? null : task.acceptedAt,
    completedAt: status !== "completed" || !isValidDate(task.completedAt) ? null : task.completedAt,
    priority: typeof task.priority === "string" && VALID_PRIORITIES.has(task.priority)
      ? task.priority
      : "medium",
    status,
    completed: status === "completed"
  };
}

function loadTasks() {
  let rawTasks;
  let originalValue;

  try {
    originalValue = window.localStorage.getItem(TASKS_STORAGE_KEY);
    if (originalValue === null) return [];
    rawTasks = JSON.parse(originalValue);
  } catch {
    const preserved = preserveRawTaskData(originalValue);
    showStatus(preserved
      ? "Không đọc được dữ liệu công việc. Bản dữ liệu gốc đã được giữ để khôi phục."
      : "Không đọc được dữ liệu công việc; thao tác lưu đã bị khóa để tránh ghi đè dữ liệu gốc.", "error");
    return [];
  }

  if (!Array.isArray(rawTasks)) {
    const preserved = preserveRawTaskData(originalValue);
    showStatus(preserved
      ? "Dữ liệu công việc không đúng định dạng. Bản gốc đã được giữ để khôi phục."
      : "Dữ liệu sai định dạng; thao tác lưu đã bị khóa để tránh ghi đè dữ liệu gốc.", "error");
    return [];
  }

  const usedIds = new Set();
  const migratedTasks = rawTasks.map((task) => normalizeTask(task, usedIds));
  const validTasks = migratedTasks.filter(Boolean);
  const migrationNeeded = JSON.stringify(validTasks) !== JSON.stringify(rawTasks);

  if (migrationNeeded) {
    try {
      if (window.localStorage.getItem(TASKS_BACKUP_KEY) === null) {
        window.localStorage.setItem(TASKS_BACKUP_KEY, originalValue);
      }
      window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(validTasks));
      if (validTasks.length !== rawTasks.length) {
        showStatus("Các công việc hợp lệ đã được nâng cấp; bản sao dữ liệu gốc được giữ trong bộ nhớ trình duyệt.", "warning");
      }
    } catch {
      showStatus("Không thể sao lưu hoặc nâng cấp dữ liệu cũ. Bản dữ liệu gốc vẫn được giữ lại.", "error");
      return rawTasks.filter((task) => task && typeof task === "object" && typeof (task.title || task.text) === "string")
        .map((task, index) => normalizeTask({ ...task, id: task.id || `legacy-${index}` }, new Set()));
    }
  }

  return validTasks;
}

function saveTasks(nextTasks) {
  if (storageWriteBlocked) {
    showStatus("Không thể lưu vì chưa tạo được bản sao an toàn của dữ liệu hiện có.", "error");
    return false;
  }
  try {
    window.localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(nextTasks));
    return true;
  } catch {
    showStatus("Không thể lưu dữ liệu trên thiết bị. Hãy kiểm tra dung lượng hoặc quyền lưu trữ của trình duyệt.", "error");
    return false;
  }
}

function saveUserName(name) {
  try {
    if (name) window.localStorage.setItem(NAME_STORAGE_KEY, name);
    else window.localStorage.removeItem(NAME_STORAGE_KEY);
    return true;
  } catch {
    showStatus("Không thể lưu tên trên thiết bị.", "error");
    return false;
  }
}

function dateTimeForInput(date = new Date()) {
  const offset = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatDateTime(value) {
  if (!isValidDate(value)) return "Chưa ghi nhận";
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(new Date(value)).replace(",", " ·");
}

function getDeadlineState(task, now = Date.now()) {
  if (!task.deadline) return { key: "no-deadline", label: "Chưa có hạn" };
  if (task.status === "completed") {
    const late = task.completedAt && Date.parse(task.completedAt) > Date.parse(task.deadline);
    return { key: late ? "completed-late" : "completed", label: late ? "Hoàn thành trễ" : "Đã hoàn thành" };
  }
  const remaining = Date.parse(task.deadline) - now;
  if (remaining < 0) return { key: "overdue", label: "Quá hạn" };
  if (remaining < 24 * 60 * 60 * 1000) return { key: "due-soon", label: "Sắp hết hạn" };
  return { key: "on-time", label: "Còn hạn" };
}

function isOverdue(task, now = Date.now()) {
  return task.status !== "completed" && isValidDate(task.deadline) && Date.parse(task.deadline) < now;
}

function getVisibleTasks() {
  const query = $("#task-search").value.trim().toLocaleLowerCase("vi-VN");

  return tasks.filter((task) => {
    const matchesFilter = currentFilter === "all"
      || (currentFilter === "incomplete" && task.status !== "completed")
      || (currentFilter === "overdue" && isOverdue(task))
      || task.status === currentFilter;
    const matchesPriority = currentPriority === "all" || task.priority === currentPriority;
    const searchContent = [task.title, task.assignedBy, task.assignedTo || "", task.description]
      .join(" ").toLocaleLowerCase("vi-VN");
    return matchesFilter && matchesPriority && (!query || searchContent.includes(query));
  });
}

function createElement(tag, className, text) {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
}

function createIconButton(label, action, iconMarkup, className = "") {
  const button = createElement("button", `icon-button ${className}`.trim());
  button.type = "button";
  button.dataset.action = action;
  button.setAttribute("aria-label", label);
  button.title = label;
  button.innerHTML = iconMarkup;
  return button;
}

function createTaskCard(task) {
  const card = createElement("li", `task-card${task.status === "completed" ? " task-card-completed" : ""}`);
  card.dataset.taskId = task.id;

  const heading = createElement("div", "task-card-heading");
  const titleGroup = createElement("div", "task-title-group");
  const title = createElement("h3", "task-card-title", task.title);
  const id = createElement("span", "task-id", `#${task.id.slice(0, 8)}`);
  titleGroup.append(title, id);

  const badges = createElement("div", "task-badges");
  const statusBadge = createElement("span", `status-badge status-${task.status}`, STATUS_LABELS[task.status]);
  const priorityBadge = createElement("span", `priority-badge priority-${task.priority}`, PRIORITY_LABELS[task.priority]);
  const deadlineState = getDeadlineState(task);
  const deadlineBadge = createElement("span", `deadline-badge deadline-${deadlineState.key}`, deadlineState.label);
  badges.append(statusBadge, priorityBadge, deadlineBadge);
  heading.append(titleGroup, badges);

  const metadata = createElement("div", "task-card-meta");
  const metadataItems = [
    ["NGƯỜI GIAO", task.assignedBy || "Chưa ghi nhận"],
    ["NGƯỜI NHẬN", task.assignedTo || "Chưa có người nhận"],
    ["NGÀY TẠO", formatDateTime(task.createdAt)],
    ["HẠN HOÀN THÀNH", task.deadline ? formatDateTime(task.deadline) : "Không có hạn (dữ liệu cũ)"]
  ];
  metadataItems.forEach(([label, value]) => {
    const item = createElement("div", "task-meta-item");
    item.append(createElement("span", "task-meta-label", label), createElement("span", "task-meta-value", value));
    metadata.append(item);
  });

  const description = createElement("p", "task-description-preview", task.description || "Công việc cũ chưa có mô tả.");
  const footer = createElement("div", "task-card-footer");
  const owner = createElement("span", "task-owner-label",
    task.status === "completed" && task.assignedTo
      ? `Hoàn thành bởi ${task.assignedTo}`
      : task.acceptedAt
        ? `Đã nhận ${formatDateTime(task.acceptedAt)}`
        : "Chưa có người nhận");
  const actions = createElement("div", "task-actions");
  const details = createElement("button", "task-action-button task-action-secondary", "Chi tiết");
  details.type = "button";
  details.dataset.action = "details";
  if (task.status === "pending") {
    const accept = createElement("button", "task-action-button task-action-primary", "Nhận việc");
    accept.type = "button";
    accept.dataset.action = "accept";
    actions.append(accept);
  }
  const edit = createElement("button", "task-action-button task-action-secondary", "Sửa");
  edit.type = "button";
  edit.dataset.action = "edit";
  const remove = createElement("button", "task-action-button task-action-danger", "Xóa");
  remove.type = "button";
  remove.dataset.action = "delete";
  actions.append(details, edit, remove);
  footer.append(owner, actions);

  card.append(heading, metadata, description, footer);
  return card;
}

function renderTasks() {
  const visibleTasks = getVisibleTasks();
  taskList.replaceChildren();
  taskList.hidden = visibleTasks.length === 0;
  $("#empty-state").hidden = visibleTasks.length > 0;

  if (visibleTasks.length) {
    const fragment = document.createDocumentFragment();
    visibleTasks.forEach((task) => fragment.append(createTaskCard(task)));
    taskList.append(fragment);
  } else if (tasks.length === 0) {
    $("#empty-title").textContent = "Một khởi đầu thật tốt!";
    $("#empty-description").textContent = "Tạo công việc đầu tiên để bắt đầu.";
  } else {
    $("#empty-title").textContent = "Không tìm thấy công việc";
    $("#empty-description").textContent = "Thay đổi bộ lọc hoặc từ khóa tìm kiếm.";
  }

  updateStatistics();
  updateFilterControls();
}

function updateStatistics() {
  const counts = {
    pending: tasks.filter((task) => task.status === "pending").length,
    accepted: tasks.filter((task) => task.status === "accepted").length,
    in_progress: tasks.filter((task) => task.status === "in_progress").length,
    completed: tasks.filter((task) => task.status === "completed").length,
    overdue: tasks.filter((task) => isOverdue(task)).length
  };
  $("#total-count").textContent = String(tasks.length);
  $("#pending-count").textContent = String(counts.pending);
  $("#accepted-count").textContent = String(counts.accepted);
  $("#in-progress-count").textContent = String(counts.in_progress);
  $("#completed-count").textContent = String(counts.completed);
  $("#overdue-count").textContent = String(counts.overdue);
  $("#nav-total").textContent = String(tasks.length);
  $("#filter-total").textContent = String(tasks.length);
  $("#footer-summary").textContent =
    `${tasks.length} công việc · ${counts.completed} đã xong · ${tasks.length - counts.completed} chưa xong`;
}

function updateFilterControls() {
  document.querySelectorAll("[data-filter]").forEach((control) => {
    const isActive = control.matches(".nav-link")
      ? control.dataset.navView === currentNavView
      : control.dataset.filter === currentFilter;
    control.classList.toggle("is-active", isActive);
    if (control.matches(".filter-button")) control.setAttribute("aria-pressed", String(isActive));
    if (control.matches(".nav-link")) {
      if (isActive) control.setAttribute("aria-current", "page");
      else control.removeAttribute("aria-current");
    }
  });
}

function updateGreeting() {
  const displayName = userName || "bạn";
  $("#welcome-title").textContent = `Chào ${displayName}, hôm nay bạn thế nào?`;
  $("#profile-name").textContent = userName || "Bạn";
  $("#avatar-initials").textContent = userName
    ? Array.from(userName.trim())[0].toLocaleUpperCase("vi-VN")
    : "B";
  $("#task-assigned-by").value = userName;
}

function updateClock() {
  const now = new Date();
  $("#current-date").textContent = new Intl.DateTimeFormat("vi-VN", {
    weekday: "short", day: "2-digit", month: "short"
  }).format(now);
  $("#current-time").textContent = new Intl.DateTimeFormat("vi-VN", {
    hour: "2-digit", minute: "2-digit", hour12: false
  }).format(now);
  $("#current-time").dateTime = now.toISOString();
  $("#panel-date").textContent = new Intl.DateTimeFormat("vi-VN", {
    weekday: "long", day: "numeric", month: "long", year: "numeric"
  }).format(now);
  $("#task-deadline").min = dateTimeForInput(now);
}

function closeMobileMenu() {
  $("#sidebar").classList.remove("is-open");
  $("#sidebar-backdrop").classList.remove("is-visible");
  $("#menu-button").setAttribute("aria-expanded", "false");
}

function openTaskDetails(taskId) {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) return;
  activeTaskId = taskId;

  const content = $("#detail-content");
  content.replaceChildren();
  const heading = createElement("div", "detail-title-row");
  heading.append(
    createElement("h3", "detail-task-title", task.title),
    createElement("span", `status-badge status-${task.status}`, STATUS_LABELS[task.status])
  );
  content.append(heading);

  const details = [
    ["Mã công việc", task.id],
    ["Người giao", task.assignedBy || "Chưa ghi nhận"],
    ["Người nhận", task.assignedTo || "Chưa có người nhận"],
    ["Ngày tạo", formatDateTime(task.createdAt)],
    ["Hạn hoàn thành", task.deadline ? formatDateTime(task.deadline) : "Không có hạn (dữ liệu cũ)"],
    ["Thời gian nhận", task.acceptedAt ? formatDateTime(task.acceptedAt) : "Chưa nhận"],
    ["Thời gian hoàn thành", task.completedAt ? formatDateTime(task.completedAt) : "Chưa hoàn thành"],
    ["Ưu tiên", PRIORITY_LABELS[task.priority]],
    ["Tình trạng thời hạn", getDeadlineState(task).label]
  ];
  const grid = createElement("dl", "detail-grid");
  details.forEach(([label, value]) => {
    const group = createElement("div", "detail-field");
    group.append(createElement("dt", "", label), createElement("dd", "", value));
    grid.append(group);
  });
  content.append(grid, createElement("h4", "detail-description-heading", "Nội dung chi tiết"));
  content.append(createElement("p", "detail-description", task.description || "Công việc cũ chưa có mô tả."));
  renderDetailActions(task);
  detailDialog.showModal();
}

function addDetailAction(label, action, className) {
  const button = createElement("button", `task-action-button ${className}`, label);
  button.type = "button";
  button.dataset.detailAction = action;
  $("#detail-actions").append(button);
}

function renderDetailActions(task) {
  const actions = $("#detail-actions");
  actions.replaceChildren();
  if (task.status === "pending") addDetailAction("Nhận công việc", "accept", "task-action-primary");
  if (task.status === "accepted") addDetailAction("Bắt đầu", "start", "task-action-primary");
  if (task.status === "in_progress") addDetailAction("Hoàn thành", "complete", "task-action-primary");
  if (task.status === "completed") addDetailAction("Đánh dấu chưa hoàn thành", "reopen", "task-action-secondary");
  if (task.status !== "pending" && task.status !== "completed") {
    addDetailAction("Trả công việc", "return", "task-action-secondary");
  }
  addDetailAction("Sửa", "edit", "task-action-secondary");
  addDetailAction("Xóa", "delete", "task-action-danger");
  addDetailAction("Đóng", "close", "task-action-secondary");
}

function showAcceptDialog(taskId) {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task || task.status !== "pending") {
    showStatus("Công việc này đã có người nhận hoặc không còn khả dụng.", "warning");
    renderTasks();
    return;
  }
  activeTaskId = taskId;
  const summary = $("#accept-summary");
  summary.replaceChildren(
    createElement("strong", "", task.title),
    createElement("span", "", `Người giao: ${task.assignedBy}`),
    createElement("span", "", `Hạn: ${task.deadline ? formatDateTime(task.deadline) : "Không có hạn (dữ liệu cũ)"}`),
    createElement("p", "", task.description || "Không có mô tả.")
  );
  $("#assignee-name").value = userName;
  acceptDialog.showModal();
  $("#assignee-name").focus();
}

function openEditDialog(taskId) {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) return;
  editingTaskId = taskId;
  $("#task-dialog-title").textContent = "Sửa thông tin công việc";
  $("#save-task-button").textContent = "Lưu thay đổi";
  $("#task-title").value = task.title;
  $("#task-assigned-by").value = task.assignedBy;
  $("#task-description").value = task.description;
  $("#task-priority").value = task.priority;
  $("#task-deadline").value = task.deadline ? dateTimeForInput(new Date(task.deadline)) : "";
  taskDialog.showModal();
  $("#task-title").focus();
}

function resetTaskForm() {
  editingTaskId = null;
  taskForm.reset();
  $("#task-dialog-title").textContent = "Tạo công việc mới";
  $("#save-task-button").textContent = "Tạo công việc";
  $("#task-assigned-by").value = userName;
}

function showConfirmation(title, message, confirmLabel = "Xác nhận") {
  $("#confirm-title").textContent = title;
  $("#confirm-message").textContent = message;
  $("#confirm-action").textContent = confirmLabel;
  confirmDialog.showModal();
  return new Promise((resolve) => {
    confirmResolver = resolve;
  });
}

function persistMutation(mutator, successMessage) {
  const previousTasks = structuredClone(tasks);
  mutator();
  if (!saveTasks(tasks)) {
    tasks = previousTasks;
    renderTasks();
    return false;
  }
  renderTasks();
  if (successMessage) showStatus(successMessage, "success");
  return true;
}

function transitionTask(taskId, nextStatus) {
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) return false;
  if (nextStatus === "in_progress" && !task.assignedTo) {
    showStatus("Chỉ công việc đã có người nhận mới được bắt đầu thực hiện.", "warning");
    return false;
  }
  const transitions = {
    pending: ["accepted"],
    accepted: ["in_progress", "pending"],
    in_progress: ["completed", "pending"],
    completed: ["in_progress", "pending"]
  };
  if (!transitions[task.status]?.includes(nextStatus)) {
    showStatus("Không thể chuyển công việc từ trạng thái hiện tại theo thao tác này.", "warning");
    return false;
  }

  return persistMutation(() => {
    task.status = nextStatus;
    task.completed = nextStatus === "completed";
    if (nextStatus === "pending") {
      task.assignedTo = null;
      task.acceptedAt = null;
      task.completedAt = null;
    } else if (nextStatus === "completed") {
      task.completedAt = new Date().toISOString();
    } else {
      task.completedAt = null;
    }
  }, {
    accepted: "Đã nhận công việc.",
    in_progress: "Đã cập nhật trạng thái công việc.",
    completed: "Công việc đã hoàn thành.",
    pending: "Đã trả công việc về danh sách chờ nhận."
  }[nextStatus]);
}

function validateTaskForm() {
  const title = $("#task-title").value.trim();
  const assignedBy = $("#task-assigned-by").value.trim();
  const description = $("#task-description").value.trim();
  const deadlineValue = $("#task-deadline").value;
  const deadline = deadlineValue ? new Date(deadlineValue) : null;
  const existingTask = editingTaskId
    ? tasks.find((task) => task.id === editingTaskId)
    : null;
  const unchangedLegacyDescription = existingTask && !existingTask.description && !description;
  const unchangedLegacyDeadline = existingTask && !existingTask.deadline && !deadlineValue;
  const unchangedDeadline = existingTask
    && existingTask.deadline
    && deadline
    && dateTimeForInput(new Date(existingTask.deadline)) === deadlineValue;

  if (!title) return { error: "Vui lòng nhập tên công việc.", field: $("#task-title") };
  if (title.length > 150) return { error: "Tên công việc không được vượt quá 150 ký tự.", field: $("#task-title") };
  if (!assignedBy) return { error: "Vui lòng nhập tên người giao công việc.", field: $("#task-assigned-by") };
  if (!description && !unchangedLegacyDescription) {
    return { error: "Vui lòng nhập mô tả chi tiết công việc.", field: $("#task-description") };
  }
  if (description.length > 3000) return { error: "Mô tả không được vượt quá 3.000 ký tự.", field: $("#task-description") };
  if ((!deadlineValue && !unchangedLegacyDeadline) || (deadlineValue && Number.isNaN(deadline.getTime()))) {
    return { error: "Vui lòng chọn hạn hoàn thành hợp lệ.", field: $("#task-deadline") };
  }
  if (deadline && deadline.getTime() <= Date.now() && !unchangedDeadline) {
    return { error: "Hạn hoàn thành phải ở thời điểm trong tương lai.", field: $("#task-deadline") };
  }

  return {
    value: {
      title,
      assignedBy,
      description,
      deadline: unchangedDeadline
        ? existingTask.deadline
        : deadline
          ? deadline.toISOString()
          : null,
      priority: $("#task-priority").value
    }
  };
}

taskForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const validation = validateTaskForm();
  if (validation.error) {
    showStatus(validation.error, "warning");
    validation.field.focus();
    return;
  }

  if (editingTaskId) {
    const task = tasks.find((candidate) => candidate.id === editingTaskId);
    if (!task) {
      showStatus("Không tìm thấy công việc cần chỉnh sửa.", "error");
      taskDialog.close();
      resetTaskForm();
      return;
    }
    const saved = persistMutation(() => Object.assign(task, validation.value), "Đã cập nhật thông tin công việc.");
    if (saved) {
      taskDialog.close();
      resetTaskForm();
    }
    return;
  }

  const newTask = {
    id: createTaskId(),
    ...validation.value,
    assignedTo: null,
    createdAt: new Date().toISOString(),
    acceptedAt: null,
    completedAt: null,
    status: "pending",
    completed: false
  };
  const saved = persistMutation(() => tasks.unshift(newTask), "Đã tạo công việc mới.");
  if (saved) {
    taskDialog.close();
    resetTaskForm();
    currentFilter = "all";
    currentNavView = "all";
    renderTasks();
  }
});

$("#accept-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const name = $("#assignee-name").value.trim();
  if (!name) {
    showStatus("Vui lòng nhập tên người nhận công việc.", "warning");
    $("#assignee-name").focus();
    return;
  }
  const task = tasks.find((candidate) => candidate.id === activeTaskId);
  if (!task || task.status !== "pending" || task.assignedTo) {
    acceptDialog.close();
    showStatus("Công việc đã được nhận; không thể nhận trùng.", "warning");
    renderTasks();
    return;
  }
  const saved = persistMutation(() => {
    task.assignedTo = name;
    task.acceptedAt = new Date().toISOString();
    task.status = "accepted";
    task.completed = false;
  }, `Đã giao công việc cho ${name}.`);
  if (saved) {
    acceptDialog.close();
    if (detailDialog.open) openTaskDetails(task.id);
  }
});

document.querySelectorAll("[data-filter]").forEach((control) => {
  control.addEventListener("click", (event) => {
    event.preventDefault();
    currentFilter = control.dataset.filter || "all";
    currentNavView = control.matches(".nav-link") ? control.dataset.navView : currentFilter;
    renderTasks();
    if (control.matches(".nav-link")) closeMobileMenu();
  });
});

document.querySelectorAll("[data-close-dialog]").forEach((button) => {
  button.addEventListener("click", () => {
    const dialog = $(`#${button.dataset.closeDialog}`);
    if (dialog.open) dialog.close();
  });
});

taskDialog.addEventListener("close", resetTaskForm);

taskList.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-action]");
  if (!button || !taskList.contains(button)) return;
  const card = button.closest("[data-task-id]");
  if (!card) return;
  const taskId = card.dataset.taskId;
  const task = tasks.find((candidate) => candidate.id === taskId);
  if (!task) return;

  switch (button.dataset.action) {
    case "details":
      openTaskDetails(taskId);
      break;
    case "accept":
      showAcceptDialog(taskId);
      break;
    case "edit":
      openEditDialog(taskId);
      break;
    case "delete":
      if (await showConfirmation("Xóa công việc?", `Bạn sắp xóa “${task.title}”. Thao tác này không thể hoàn tác.`, "Xóa công việc")) {
        const previousTasks = structuredClone(tasks);
        tasks = tasks.filter((candidate) => candidate.id !== taskId);
        if (!saveTasks(tasks)) tasks = previousTasks;
        else showStatus("Đã xóa công việc.", "success");
        renderTasks();
      }
      break;
    default:
      break;
  }
});

$("#detail-actions").addEventListener("click", async (event) => {
  const button = event.target.closest("[data-detail-action]");
  if (!button) return;
  const task = tasks.find((candidate) => candidate.id === activeTaskId);
  if (!task) return;

  switch (button.dataset.detailAction) {
    case "accept":
      detailDialog.close();
      showAcceptDialog(task.id);
      break;
    case "start":
      if (transitionTask(task.id, "in_progress")) openTaskDetails(task.id);
      break;
    case "complete":
      if (transitionTask(task.id, "completed")) openTaskDetails(task.id);
      break;
    case "return":
      if (task.status === "completed") {
        showStatus("Không thể trả công việc đã hoàn thành.", "warning");
      } else if (await showConfirmation("Trả công việc?", "Người nhận hiện tại sẽ được gỡ và công việc trở về trạng thái chờ nhận.", "Trả công việc")) {
        if (transitionTask(task.id, "pending")) openTaskDetails(task.id);
      }
      break;
    case "reopen":
      if (await showConfirmation(
        "Mở lại công việc?",
        task.assignedTo
          ? "Công việc sẽ chuyển về trạng thái đang thực hiện và vẫn giữ người nhận."
          : "Công việc sẽ trở về trạng thái chờ nhận vì chưa có người nhận.",
        "Mở lại"
      )) {
        if (transitionTask(task.id, task.assignedTo ? "in_progress" : "pending")) openTaskDetails(task.id);
      }
      break;
    case "edit":
      detailDialog.close();
      openEditDialog(task.id);
      break;
    case "delete":
      if (await showConfirmation("Xóa công việc?", `Bạn sắp xóa “${task.title}”. Thao tác này không thể hoàn tác.`, "Xóa công việc")) {
        const previousTasks = structuredClone(tasks);
        tasks = tasks.filter((candidate) => candidate.id !== task.id);
        if (!saveTasks(tasks)) tasks = previousTasks;
        else showStatus("Đã xóa công việc.", "success");
        renderTasks();
        detailDialog.close();
      }
      break;
    case "close":
      detailDialog.close();
      break;
    default:
      break;
  }
});

confirmDialog.addEventListener("close", () => {
  if (confirmResolver) {
    confirmResolver(confirmDialog.returnValue === "confirm");
    confirmResolver = null;
  }
});

$("#confirm-action").addEventListener("click", (event) => {
  event.preventDefault();
  confirmDialog.close("confirm");
});

$("#task-search").addEventListener("input", renderTasks);
$("#priority-filter").addEventListener("change", (event) => {
  currentPriority = event.target.value;
  renderTasks();
});

$("#menu-button").addEventListener("click", () => {
  const isOpen = $("#sidebar").classList.toggle("is-open");
  $("#sidebar-backdrop").classList.toggle("is-visible", isOpen);
  $("#menu-button").setAttribute("aria-expanded", String(isOpen));
});
$("#sidebar-backdrop").addEventListener("click", closeMobileMenu);
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") closeMobileMenu();
});

$("#edit-name-button").addEventListener("click", () => {
  $("#name-input").value = userName;
  nameDialog.showModal();
  $("#name-input").focus();
});
function closeNameDialog() {
  nameDialog.close();
}
$("#close-name-dialog").addEventListener("click", closeNameDialog);
$("#cancel-name-button").addEventListener("click", closeNameDialog);
$("#name-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const nextName = $("#name-input").value.trim();
  if (!nextName) {
    showStatus("Tên hiển thị không được để trống.", "warning");
    $("#name-input").focus();
    return;
  }
  if (saveUserName(nextName)) {
    userName = nextName;
    updateGreeting();
    nameDialog.close();
  }
});

$("#open-create-dialog").addEventListener("click", () => {
  resetTaskForm();
  $("#task-deadline").min = dateTimeForInput();
  taskDialog.showModal();
  $("#task-title").focus();
});

updateGreeting();
updateClock();
renderTasks();
window.setInterval(updateClock, 1000);
window.setInterval(() => {
  updateStatistics();
  renderTasks();
}, 60_000);
