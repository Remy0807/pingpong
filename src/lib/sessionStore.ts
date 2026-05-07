let authToken: string | null = null;
let activeGroupId: string | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function getAuthToken() {
  return authToken;
}

export function setActiveGroupId(groupId: string | null) {
  activeGroupId = groupId;
}

export function getActiveGroupId() {
  return activeGroupId;
}

