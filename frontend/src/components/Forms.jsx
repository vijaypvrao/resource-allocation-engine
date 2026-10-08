import React, { useState } from 'react';
import { API, emptyResource, emptyRequest } from '../config.js';
export function ResourceForm({ onSaved }) {
  const [form, setForm] =
    useState(emptyResource);

  const [busy, setBusy] =
    useState(false);

  const update = (
    key,
    value
  ) => {
    setForm(previous => ({
      ...previous,
      [key]: value
    }));
  };

  const submit = async event => {
    event.preventDefault();
    setBusy(true);

    try {
      const body = {
        ...form,
        lat: Number(form.lat),
        lng: Number(form.lng),
        capabilities:
          form.capabilities
            .split(',')
            .map(item =>
              item.trim()
            )
            .filter(Boolean)
      };

      const response = await fetch(
        `${API}/resources`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify(body)
        }
      );

      if (!response.ok) {
        const error =
          await response.json();

        throw new Error(
          error.detail ||
            'Could not add resource'
        );
      }

      setForm({
        ...emptyResource
      });

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
    <form
      onSubmit={submit}
      className="form"
    >
      <input
        required
        placeholder="Resource ID"
        value={form.id}
        onChange={event =>
          update(
            'id',
            event.target.value
          )
        }
      />

      <input
        required
        placeholder="Name"
        value={form.name}
        onChange={event =>
          update(
            'name',
            event.target.value
          )
        }
      />

      <div className="two">
        <input
          required
          type="number"
          step="any"
          placeholder="Latitude"
          value={form.lat}
          onChange={event =>
            update(
              'lat',
              event.target.value
            )
          }
        />

        <input
          required
          type="number"
          step="any"
          placeholder="Longitude"
          value={form.lng}
          onChange={event =>
            update(
              'lng',
              event.target.value
            )
          }
        />
      </div>

      <input
        placeholder="Capabilities, e.g. electrical,hvac"
        value={
          form.capabilities
        }
        onChange={event =>
          update(
            'capabilities',
            event.target.value
          )
        }
      />

      <div className="two">
        <label>
          Available from

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
        </label>

        <label>
          Available until

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
        </label>
      </div>

      <button
        type="submit"
        disabled={busy}
      >
        {busy
          ? 'Saving…'
          : 'Add resource'}
      </button>
    </form>
  );
}

export function RequestForm({ onSaved }) {
  const [form, setForm] =
    useState(emptyRequest);

  const [busy, setBusy] =
    useState(false);

  const update = (
    key,
    value
  ) => {
    setForm(previous => ({
      ...previous,
      [key]: value
    }));
  };

  const submit = async event => {
    event.preventDefault();
    setBusy(true);

    try {
      const body = {
        ...form,
        lat: Number(form.lat),
        lng: Number(form.lng),
        priority: Number(
          form.priority
        ),
        requirements:
          form.requirements
            .split(',')
            .map(item =>
              item.trim()
            )
            .filter(Boolean)
      };

      const response = await fetch(
        `${API}/requests`,
        {
          method: 'POST',
          headers: {
            'Content-Type':
              'application/json'
          },
          body: JSON.stringify(body)
        }
      );

      if (!response.ok) {
        const error =
          await response.json();

        throw new Error(
          error.detail ||
            'Could not add request'
        );
      }

      setForm({
        ...emptyRequest
      });

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
    <form
      onSubmit={submit}
      className="form"
    >
      <input
        required
        placeholder="Request ID"
        value={form.id}
        onChange={event =>
          update(
            'id',
            event.target.value
          )
        }
      />

      <input
        required
        placeholder="Title"
        value={form.title}
        onChange={event =>
          update(
            'title',
            event.target.value
          )
        }
      />

      <div className="two">
        <input
          required
          type="number"
          step="any"
          placeholder="Latitude"
          value={form.lat}
          onChange={event =>
            update(
              'lat',
              event.target.value
            )
          }
        />

        <input
          required
          type="number"
          step="any"
          placeholder="Longitude"
          value={form.lng}
          onChange={event =>
            update(
              'lng',
              event.target.value
            )
          }
        />
      </div>

      <input
        placeholder="Requirements, e.g. electrical,hvac"
        value={
          form.requirements
        }
        onChange={event =>
          update(
            'requirements',
            event.target.value
          )
        }
      />

      <div className="two">
        <label>
          Start

          <input
            required
            type="datetime-local"
            value={form.start}
            onChange={event =>
              update(
                'start',
                event.target.value
              )
            }
          />
        </label>

        <label>
          End

          <input
            required
            type="datetime-local"
            value={form.end}
            onChange={event =>
              update(
                'end',
                event.target.value
              )
            }
          />
        </label>
      </div>

      <label>
        Priority (1-5)

        <input
          required
          type="number"
          min="1"
          max="5"
          value={form.priority}
          onChange={event =>
            update(
              'priority',
              event.target.value
            )
          }
        />
      </label>

      <button
        type="submit"
        disabled={busy}
      >
        {busy
          ? 'Saving…'
          : 'Add request'}
      </button>
    </form>
  );
}
