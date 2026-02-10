// ===== Google Apps Script - Task Dashboard API =====
// Deploy as Web App: Execute as ME, Access: Anyone
// Sheet ID: 1yp-X-EhguI81C-wKVza3fjGp2HKvVDTj8tGc9tiDELA

const SHEET_ID = '1yp-X-EhguI81C-wKVza3fjGp2HKvVDTj8tGc9tiDELA';
const SHEET_NAME = 'Sheet1'; // hoặc tên tab anh đặt

function doGet(e) {
  const action = e.parameter.action || 'list';
  let result;
  
  try {
    switch(action) {
      case 'list':
        result = listTasks();
        break;
      case 'get':
        result = getTask(e.parameter.id);
        break;
      default:
        result = { error: 'Unknown action' };
    }
  } catch(err) {
    result = { error: err.message };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const data = JSON.parse(e.postData.contents);
  const action = data.action || 'add';
  let result;
  
  try {
    switch(action) {
      case 'add':
        result = addTask(data);
        break;
      case 'update':
        result = updateTask(data);
        break;
      case 'delete':
        result = deleteTask(data.id);
        break;
      case 'move':
        result = moveTask(data.id, data.status);
        break;
      default:
        result = { error: 'Unknown action' };
    }
  } catch(err) {
    result = { error: err.message };
  }
  
  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

// ===== CRUD Functions =====

function listTasks() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  if (data.length <= 1) return { tasks: [] };
  
  const headers = data[0];
  const tasks = [];
  
  for (let i = 1; i < data.length; i++) {
    if (!data[i][0]) continue; // skip empty rows
    const task = {};
    headers.forEach((h, j) => { task[h] = data[i][j]; });
    tasks.push(task);
  }
  
  return { tasks: tasks };
}

function getTask(id) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  const headers = data[0];
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      const task = {};
      headers.forEach((h, j) => { task[h] = data[i][j]; });
      return { task: task };
    }
  }
  return { error: 'Task not found' };
}

function addTask(data) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const now = new Date().toISOString();
  const id = 'task_' + Date.now() + '_' + Math.random().toString(36).substr(2, 4);
  
  const row = [
    id,
    data.title || '',
    data.description || '',
    data.assignee || 'kate',
    data.priority || 'medium',
    data.status || 'new',
    now,
    now
  ];
  
  sheet.appendRow(row);
  
  return { 
    success: true, 
    task: {
      id: id,
      title: data.title,
      description: data.description || '',
      assignee: data.assignee || 'kate',
      priority: data.priority || 'medium',
      status: data.status || 'new',
      createdAt: now,
      updatedAt: now
    }
  };
}

function updateTask(data) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const allData = sheet.getDataRange().getValues();
  const headers = allData[0];
  const now = new Date().toISOString();
  
  for (let i = 1; i < allData.length; i++) {
    if (allData[i][0] === data.id) {
      const rowNum = i + 1;
      
      if (data.title !== undefined) sheet.getRange(rowNum, 2).setValue(data.title);
      if (data.description !== undefined) sheet.getRange(rowNum, 3).setValue(data.description);
      if (data.assignee !== undefined) sheet.getRange(rowNum, 4).setValue(data.assignee);
      if (data.priority !== undefined) sheet.getRange(rowNum, 5).setValue(data.priority);
      if (data.status !== undefined) sheet.getRange(rowNum, 6).setValue(data.status);
      sheet.getRange(rowNum, 8).setValue(now); // updatedAt
      
      return { success: true, id: data.id };
    }
  }
  return { error: 'Task not found' };
}

function deleteTask(id) {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const data = sheet.getDataRange().getValues();
  
  for (let i = 1; i < data.length; i++) {
    if (data[i][0] === id) {
      sheet.deleteRow(i + 1);
      return { success: true, id: id };
    }
  }
  return { error: 'Task not found' };
}

function moveTask(id, newStatus) {
  return updateTask({ id: id, status: newStatus });
}

// ===== Setup (run once) =====
function setupHeaders() {
  const sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);
  const headers = ['id', 'title', 'description', 'assignee', 'priority', 'status', 'createdAt', 'updatedAt'];
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  sheet.setFrozenRows(1);
}
