import React, { useState } from 'react';
import { API, emptyResource, emptyRequest } from '../config.js';
export function ResourcesTable({
  resources,
  onSaved
}) {
  const [adding, setAdding] =
    useState(false);

  const [form, setForm] =
    useState(emptyResource);

  const [busy, setBusy] =
    useState(false);

  const update = (
    field,
    value
  ) => {
    setForm(previous => ({
      ...previous,
      [field]: value
    }));
  };

  const save = async () => {
    setBusy(true);

    try {
      const response = await fetch(
        `${API}/resources`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            id: form.id,
            name: form.name,
            lat: Number(form.lat),
            lng: Number(form.lng),
            capabilities:
              form.capabilities
                .split(',')
                .map(item =>
                  item.trim()
                )
                .filter(Boolean),
            available_from:
              form.available_from,
            available_until:
              form.available_until
          })
        }
      );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.detail ||
            'Failed to add resource'
        );
      }

      setForm({
        ...emptyResource
      });

      setAdding(false);

      onSaved();
    } catch (error) {
      console.error(
        'Resource save failed:',
        error
      );

      alert(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tableWrap">
      <table className="dataTable">
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Location</th>
            <th>
              Capabilities
            </th>
            <th>
              Availability
            </th>
          </tr>
        </thead>

        <tbody>
          {resources.map(
            resource => (
              <tr
                key={resource.id}
              >
                <td>
                  {resource.id}
                </td>

                <td>
                  {resource.name}
                </td>

                <td>
                  {
                    resource.location
                      ?.lat
                  }
                  ,{' '}
                  {
                    resource.location
                      ?.lng
                  }
                </td>

                <td>
                  {resource.capabilities?.join(
                    ', '
                  )}
                </td>

                <td>
                  {
                    resource.available_from
                  }
                  <br />
                  {
                    resource.available_until
                  }
                </td>
              </tr>
            )
          )}

          {adding && (
            <tr className="newRow">
              <td>
                <input
                  required
                  value={
                    form.id
                  }
                  onChange={event =>
                    update(
                      'id',
                      event.target.value
                    )
                  }
                  placeholder="R-006"
                />
              </td>

              <td>
                <input
                  required
                  value={
                    form.name
                  }
                  onChange={event =>
                    update(
                      'name',
                      event.target.value
                    )
                  }
                  placeholder="Technician name"
                />
              </td>

              <td>
                <input
                  required
                  value={
                    form.lat
                  }
                  onChange={event =>
                    update(
                      'lat',
                      event.target.value
                    )
                  }
                  placeholder="Lat"
                />

                <input
                  required
                  value={
                    form.lng
                  }
                  onChange={event =>
                    update(
                      'lng',
                      event.target.value
                    )
                  }
                  placeholder="Lng"
                />
              </td>

              <td>
                <input
                  value={
                    form.capabilities
                  }
                  onChange={event =>
                    update(
                      'capabilities',
                      event.target.value
                    )
                  }
                  placeholder="java, network, hardware"
                />
              </td>

              <td>
                <input
                  required
                  type="datetime-local"
                  value={
                    form.available_from
                  }
                  onChange={event =>
                    update(
                      'available_from',
                      event.target.value
                    )
                  }
                />

                <input
                  required
                  type="datetime-local"
                  value={
                    form.available_until
                  }
                  onChange={event =>
                    update(
                      'available_until',
                      event.target.value
                    )
                  }
                />

                <div className="rowActions">
                  <button
                    type="button"
                    className="smallButton primary"
                    onClick={save}
                    disabled={
                      busy
                    }
                  >
                    {busy
                      ? 'Saving…'
                      : 'Save'}
                  </button>

                  <button
                    type="button"
                    className="smallButton"
                    onClick={() => {
                      setAdding(
                        false
                      );

                      setForm({
                        ...emptyResource
                      });
                    }}
                    disabled={
                      busy
                    }
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!adding && (
        <button
          type="button"
          className="addRowButton"
          onClick={() =>
            setAdding(true)
          }
        >
          + Add Resource
        </button>
      )}
    </div>
  );
}

export function RequestsTable({
  requests,
  onSaved
}) {
  const [adding, setAdding] =
    useState(false);

  const [form, setForm] =
    useState(emptyRequest);

  const [busy, setBusy] =
    useState(false);

  const update = (
    field,
    value
  ) => {
    setForm(previous => ({
      ...previous,
      [field]: value
    }));
  };

  const save = async () => {
    setBusy(true);

    try {
      const response = await fetch(
        `${API}/requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify({
            id: form.id,
            title: form.title,
            lat: Number(form.lat),
            lng: Number(form.lng),
            requirements:
              form.requirements
                .split(',')
                .map(item =>
                  item.trim()
                )
                .filter(Boolean),
            start: form.start,
            end: form.end,
            priority: Number(
              form.priority
            )
          })
        }
      );

      const json =
        await response.json();

      if (!response.ok) {
        throw new Error(
          json.detail ||
            'Failed to add request'
        );
      }

      setForm({
        ...emptyRequest
      });

      setAdding(false);

      onSaved();
    } catch (error) {
      console.error(
        'Request save failed:',
        error
      );

      alert(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="tableWrap">
      <table className="dataTable">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Location</th>
            <th>
              Requirements
            </th>
            <th>Window</th>
            <th>Priority</th>
          </tr>
        </thead>

        <tbody>
          {requests.map(
            request => (
              <tr
                key={request.id}
              >
                <td>
                  {request.id}
                </td>

                <td>
                  {request.title}
                </td>

                <td>
                  {
                    request.location
                      ?.lat
                  }
                  ,{' '}
                  {
                    request.location
                      ?.lng
                  }
                </td>

                <td>
                  {request.requirements?.join(
                    ', '
                  )}
                </td>

                <td>
                  {request.start}
                  <br />
                  {request.end}
                </td>

                <td>
                  {request.priority}
                </td>
              </tr>
            )
          )}

          {adding && (
            <tr className="newRow">
              <td>
                <input
                  required
                  value={
                    form.id
                  }
                  onChange={event =>
                    update(
                      'id',
                      event.target.value
                    )
                  }
                  placeholder="REQ-006"
                />
              </td>

              <td>
                <input
                  required
                  value={
                    form.title
                  }
                  onChange={event =>
                    update(
                      'title',
                      event.target.value
                    )
                  }
                  placeholder="Request title"
                />
              </td>

              <td>
                <input
                  required
                  value={
                    form.lat
                  }
                  onChange={event =>
                    update(
                      'lat',
                      event.target.value
                    )
                  }
                  placeholder="Lat"
                />

                <input
                  required
                  value={
                    form.lng
                  }
                  onChange={event =>
                    update(
                      'lng',
                      event.target.value
                    )
                  }
                  placeholder="Lng"
                />
              </td>

              <td>
                <input
                  value={
                    form.requirements
                  }
                  onChange={event =>
                    update(
                      'requirements',
                      event.target.value
                    )
                  }
                  placeholder="java, network"
                />
              </td>

              <td>
                <input
                  required
                  type="datetime-local"
                  value={
                    form.start
                  }
                  onChange={event =>
                    update(
                      'start',
                      event.target.value
                    )
                  }
                />

                <input
                  required
                  type="datetime-local"
                  value={
                    form.end
                  }
                  onChange={event =>
                    update(
                      'end',
                      event.target.value
                    )
                  }
                />
              </td>

              <td>
                <input
                  required
                  type="number"
                  min="1"
                  max="5"
                  value={
                    form.priority
                  }
                  onChange={event =>
                    update(
                      'priority',
                      event.target.value
                    )
                  }
                />

                <div className="rowActions">
                  <button
                    type="button"
                    className="smallButton primary"
                    onClick={save}
                    disabled={
                      busy
                    }
                  >
                    {busy
                      ? 'Saving…'
                      : 'Save'}
                  </button>

                  <button
                    type="button"
                    className="smallButton"
                    onClick={() => {
                      setAdding(
                        false
                      );

                      setForm({
                        ...emptyRequest
                      });
                    }}
                    disabled={
                      busy
                    }
                  >
                    Cancel
                  </button>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {!adding && (
        <button
          type="button"
          className="addRowButton"
          onClick={() =>
            setAdding(true)
          }
        >
          + Add Request
        </button>
      )}
    </div>
  );
}
