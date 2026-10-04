import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import type { Priority, WorkItemDetail } from '../api/types';
import { workItemsApi, type UpdateWorkItemBody } from '../api/workItems';
import { PriorityIcon, TypeIcon, UserLabel } from '../components/ui/badges';
import { Button } from '../components/ui/Button';
import { ConfirmModal } from '../components/ui/ConfirmModal';
import { QueryError } from '../components/ui/ErrorState';
import { Input, Select, Textarea } from '../components/ui/form';
import { Comments } from '../components/workItems/Comments';
import { StatusMenu } from '../components/workItems/StatusMenu';
import { useAssignees } from '../hooks/useAssignees';
import { cx } from '../lib/cx';
import { errorMessage, hasCode } from '../lib/errors';
import { formatDateTime, fromLocalInput, isOverdue, timeAgo, toLocalInput } from '../lib/format';
import { itemKey, PRIORITIES, PRIORITY_LABELS } from '../lib/labels';
import { WorkItemDetailSkeleton } from '../components/ui/skeletons';

export function WorkItemDetailPage() {
  const { id = '' } = useParams();
  const item = useQuery({
    queryKey: ['workItem', id],
    queryFn: ({ signal }) => workItemsApi.get(id, signal),
  });

  if (item.isPending) return <WorkItemDetailSkeleton />;
  // Someone else's item (outside the user's scope) is a 404 from the API: show "not found".
  if (item.isError) return <QueryError error={item.error} onRetry={() => void item.refetch()} />;
  return <IssueView item={item.data} />;
}

/** Everything editable here is driven by the server's `permissions` and `allowedTransitions`. */
function IssueView({ item }: { item: WorkItemDetail }) {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { canEdit, canAssign, canDelete } = item.permissions;

  const refreshLists = () => {
    for (const key of ['workItems', 'board', 'summary']) {
      void queryClient.invalidateQueries({ queryKey: [key] });
    }
  };

  const update = useMutation({
    mutationFn: (body: UpdateWorkItemBody) => workItemsApi.update(item.id, body),
    onSuccess: (updated) => {
      queryClient.setQueryData(['workItem', item.id], updated);
      refreshLists();
    },
    onError: (error) => {
      const reload = () => void queryClient.invalidateQueries({ queryKey: ['workItem', item.id] });
      if (hasCode(error, 'STALE_STATE') || hasCode(error, 'INVALID_TRANSITION')) {
        toast.error(errorMessage(error), { action: { label: 'Reload', onClick: reload } });
      } else {
        toast.error(errorMessage(error));
      }
    },
  });

  const remove = useMutation({
    mutationFn: () => workItemsApi.remove(item.id),
    onSuccess: () => {
      queryClient.removeQueries({ queryKey: ['workItem', item.id] });
      refreshLists();
      toast.success(`${itemKey(item)} deleted`);
      navigate(item.project ? `/projects/${item.project.id}/board` : '/work-items', {
        replace: true,
      });
    },
    onError: (error) => toast.error(errorMessage(error)),
  });

  return (
    <div className="mx-auto max-w-6xl p-6">
      <nav
        aria-label="Breadcrumb"
        className="mb-3 flex flex-wrap items-center gap-1.5 text-fg-subtle"
      >
        {item.project ? (
          <>
            <Link to="/projects" className="hover:underline">
              Projects
            </Link>
            /
            <Link to={`/projects/${item.project.id}/board`} className="hover:underline">
              {item.project.name}
            </Link>
          </>
        ) : (
          <Link to="/work-items" className="hover:underline">
            Work items
          </Link>
        )}
        /
        <span className="inline-flex items-center gap-1.5 text-fg">
          <TypeIcon type={item.type} />
          {itemKey(item)}
        </span>
      </nav>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-6">
          <EditableTitle
            key={item.title}
            title={item.title}
            editable={canEdit}
            onSave={(title) => update.mutate({ title })}
          />
          <Description
            key={item.description}
            text={item.description}
            editable={canEdit}
            saving={update.isPending}
            onSave={(description) => update.mutate({ description })}
          />
          <Comments item={item} />
        </div>

        <aside className="space-y-4">
          <StatusMenu
            status={item.status}
            allowed={item.allowedTransitions}
            busy={update.isPending}
            onChange={(status) => update.mutate({ status })}
          />

          <section className="rounded-lg border border-border">
            <h2 className="border-b border-border px-4 py-2.5 font-semibold text-fg-strong">
              Details
            </h2>
            <dl className="space-y-3 p-4">
              <Detail label="Assignee">
                {canAssign ? (
                  <AssigneeSelect
                    item={item}
                    busy={update.isPending}
                    onChange={(assigneeId) => update.mutate({ assigneeId })}
                  />
                ) : (
                  <UserLabel user={item.assignee} />
                )}
              </Detail>
              <Detail label="Priority">
                {canEdit ? (
                  <Select
                    aria-label="Priority"
                    value={item.priority}
                    disabled={update.isPending}
                    onChange={(event) =>
                      update.mutate({ priority: event.target.value as Priority })
                    }
                  >
                    {PRIORITIES.map((priority) => (
                      <option key={priority} value={priority}>
                        {PRIORITY_LABELS[priority]}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <PriorityIcon priority={item.priority} withLabel />
                )}
              </Detail>
              <Detail label="Due date">
                {canEdit ? (
                  <DueDateInput
                    key={item.dueDate ?? 'none'}
                    value={item.dueDate}
                    onSave={(dueDate) => update.mutate({ dueDate })}
                  />
                ) : item.dueDate ? (
                  <span className={cx(isOverdue(item) && 'font-semibold text-danger')}>
                    {formatDateTime(item.dueDate)}
                  </span>
                ) : (
                  <span className="text-fg-subtle">None</span>
                )}
              </Detail>
              <Detail label="Requester">
                <UserLabel user={item.requester} />
              </Detail>
              <Detail label="Project">
                {item.project ? (
                  <Link
                    to={`/projects/${item.project.id}/board`}
                    className="text-primary hover:underline"
                  >
                    {item.project.name}
                  </Link>
                ) : (
                  <span className="text-fg-subtle">None</span>
                )}
              </Detail>
              <Detail label="Created">
                <time title={formatDateTime(item.createdAt)}>{timeAgo(item.createdAt)}</time>
              </Detail>
              <Detail label="Updated">
                <time title={formatDateTime(item.updatedAt)}>{timeAgo(item.updatedAt)}</time>
              </Detail>
            </dl>
          </section>

          {canDelete && (
            <Button variant="danger" icon={Trash} onClick={() => setConfirmDelete(true)}>
              Delete
            </Button>
          )}
        </aside>
      </div>

      <ConfirmModal
        open={confirmDelete}
        title={`Delete ${itemKey(item)}?`}
        confirmLabel="Delete"
        busy={remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() => remove.mutate()}
      >
        This permanently deletes the item with its comments and notifications.
      </ConfirmModal>
    </div>
  );
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[96px_minmax(0,1fr)] items-center gap-2">
      <dt className="text-xs font-semibold text-fg-subtle">{label}</dt>
      <dd className="min-w-0">{children}</dd>
    </div>
  );
}

/** Click to edit; Enter or blur saves, Escape cancels. */
function EditableTitle({
  title,
  editable,
  onSave,
}: {
  title: string;
  editable: boolean;
  onSave: (title: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(title);

  if (!editable) return <h1 className="text-2xl font-semibold text-fg-strong">{title}</h1>;

  const save = () => {
    setEditing(false);
    const next = draft.trim();
    if (next && next !== title) onSave(next);
    else setDraft(title);
  };

  return editing ? (
    <Input
      aria-label="Title"
      value={draft}
      maxLength={150}
      autoFocus
      onChange={(event) => setDraft(event.target.value)}
      onBlur={save}
      onKeyDown={(event) => {
        if (event.key === 'Enter') save();
        if (event.key === 'Escape') {
          setDraft(title);
          setEditing(false);
        }
      }}
      className="h-11 text-2xl font-semibold"
    />
  ) : (
    <h1>
      <button
        type="button"
        onClick={() => setEditing(true)}
        title="Edit title"
        className="-mx-2 w-full rounded-md px-2 py-0.5 text-left text-2xl font-semibold text-fg-strong hover:bg-hover"
      >
        {title}
      </button>
    </h1>
  );
}

interface DescriptionProps {
  text: string;
  editable: boolean;
  saving: boolean;
  onSave: (text: string) => void;
}

function Description({ text, editable, saving, onSave }: DescriptionProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(text);

  return (
    <section aria-labelledby="description-heading" className="space-y-2">
      <div className="flex items-center justify-between">
        <h2 id="description-heading" className="font-semibold text-fg-strong">
          Description
        </h2>
        {editable && !editing && (
          <Button size="sm" variant="subtle" icon={Pencil} onClick={() => setEditing(true)}>
            Edit
          </Button>
        )}
      </div>
      {editing ? (
        <div className="space-y-2">
          <Textarea
            aria-label="Description"
            value={draft}
            maxLength={5000}
            autoFocus
            onChange={(event) => setDraft(event.target.value)}
            className="min-h-40"
          />
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="primary"
              loading={saving}
              disabled={!draft.trim()}
              onClick={() => {
                if (draft.trim() !== text) onSave(draft.trim());
                setEditing(false);
              }}
            >
              Save
            </Button>
            <Button
              size="sm"
              variant="subtle"
              onClick={() => {
                setDraft(text);
                setEditing(false);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="break-words whitespace-pre-wrap text-fg">{text}</p>
      )}
    </section>
  );
}

/** Lists only eligible people (project members, plus the manager for tickets). */
function AssigneeSelect({
  item,
  busy,
  onChange,
}: {
  item: WorkItemDetail;
  busy: boolean;
  onChange: (assigneeId: string | null) => void;
}) {
  const { options, isLoading } = useAssignees(item.type, item.project?.id ?? null, true);
  const current = item.assignee;
  const all =
    current && !options.some((u) => u.id === current.id) ? [current, ...options] : options;

  return (
    <Select
      aria-label="Assignee"
      value={current?.id ?? ''}
      disabled={busy || isLoading}
      onChange={(event) => onChange(event.target.value || null)}
    >
      <option value="">Unassigned</option>
      {all.map((person) => (
        <option key={person.id} value={person.id}>
          {person.name}
        </option>
      ))}
    </Select>
  );
}

/** Saves on blur; a new due date must be in the future (the server checks too). */
function DueDateInput({
  value,
  onSave,
}: {
  value: string | null;
  onSave: (iso: string | null) => void;
}) {
  const initial = toLocalInput(value);
  return (
    <Input
      type="datetime-local"
      aria-label="Due date"
      defaultValue={initial}
      onBlur={(event) => {
        const next = event.target.value;
        if (next === initial) return;
        if (next && new Date(next) <= new Date()) {
          toast.error('Due date must be in the future');
          event.target.value = initial;
          return;
        }
        onSave(fromLocalInput(next));
      }}
    />
  );
}
