import { useEffect, useState } from 'react';
import { DndContext, KeyboardSensor, PointerSensor, closestCenter, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, arrayMove, sortableKeyboardCoordinates, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { api } from '../../api.js';
import { useDialog } from '../../components/Dialog.jsx';
import './MemberOrder.css';

function Row({ member, index, last, move }) {
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({ id: member._id });
  return (
    <li ref={setNodeRef} className={`order-row${isDragging ? ' dragging' : ''}`} style={{ transform: CSS.Transform.toString(transform), transition }}>
      <button type="button" ref={setActivatorNodeRef} className="order-handle" aria-label={`Arrastrar a ${member.name}`} {...attributes} {...listeners}>⠿</button>
      <span className="order-name"><strong>{index + 1}.</strong> {member.name}{member.role ? <span className="muted"> · {member.role}</span> : null}</span>
      <span className="order-moves">
        <button type="button" className="btn btn-dark sm" disabled={index === 0} onClick={() => move(index, index - 1)} aria-label={`Subir a ${member.name}`}>↑</button>
        <button type="button" className="btn btn-dark sm" disabled={last} onClick={() => move(index, index + 1)} aria-label={`Bajar a ${member.name}`}>↓</button>
      </span>
    </li>
  );
}

// Orden del equipo: se arrastra a cada persona a su lugar (ratón, dedo o teclado: Espacio para tomar, flechas para mover)
// o se usan los botones subir/bajar. Cada cambio se guarda al instante con el orden completo.
export default function MemberOrder({ onChange }) {
  const { notify } = useDialog();
  const [members, setMembers] = useState(null);
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }));

  useEffect(() => {
    let cancelled = false;
    api('/members').then((list) => !cancelled && setMembers(list)).catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function reorder(next) {
    const before = members;
    setMembers(next);
    try {
      await api('/members/order', { method: 'PUT', body: { ids: next.map((m) => m._id) } });
      onChange?.();
    } catch (err) {
      setMembers(before);
      await notify({ title: 'No se pudo guardar el orden', message: err.message });
    }
  }
  const move = (from, to) => reorder(arrayMove(members, from, to));
  const onDragEnd = ({ active, over }) => {
    if (over && active.id !== over.id) move(members.findIndex((m) => m._id === active.id), members.findIndex((m) => m._id === over.id));
  };

  if (!members || members.length < 2) return null;
  return (
    <details className="order-panel card">
      <summary>Ordenar el equipo (cómo aparece en la página «Equipo»)</summary>
      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
        <SortableContext items={members.map((m) => m._id)} strategy={verticalListSortingStrategy}>
          <ol className="order-list">
            {members.map((m, i) => <Row key={m._id} member={m} index={i} last={i === members.length - 1} move={move} />)}
          </ol>
        </SortableContext>
      </DndContext>
    </details>
  );
}
