import { apiCall } from './auth.js';

export const listGroups    = ()            => apiCall('GET',    '/v2/contacts/groups');
export const createGroup   = (data)        => apiCall('POST',   '/v2/contacts/groups', data);
export const updateGroup   = (id, data)    => apiCall('PATCH',  `/v2/contacts/groups/${id}`, data);
export const deleteGroup   = (id)          => apiCall('DELETE', `/v2/contacts/groups/${id}`);
export const listContacts  = (params = {}) => apiCall('GET',    '/v2/contacts?' + new URLSearchParams(params).toString());
export const createContact = (data)        => apiCall('POST',   '/v2/contacts', data);
export const updateContact = (id, data)    => apiCall('PATCH',  `/v2/contacts/${id}`, data);
export const deleteContact = (id)          => apiCall('DELETE', `/v2/contacts/${id}`);

export async function importCSV(file, group_id) {
  const token = localStorage.getItem('ckr_token');
  const fd = new FormData();
  fd.append('file', file);
  if (group_id) fd.append('group_id', group_id);
  const res = await fetch('/api/v2/contacts/import-csv', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body: fd,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}
