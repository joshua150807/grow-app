import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getTodos,
  addTodo,
  toggleTodo,
  deleteTodo,
  updateTodo,
} from '../services/todo';
import { sortTodos } from '../utils/todoUtils';
import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

function normalizeTodo(todo) {
  if (!todo || !todo.id) return null;

  return {
    ...todo,
    title: typeof todo.title === 'string' ? todo.title : '',
    completed: Boolean(todo.completed),
    due_at: todo.due_at ?? null,
  };
}

function normalizeTodos(todos) {
  if (!Array.isArray(todos)) return [];
  return todos.map(normalizeTodo).filter(Boolean);
}

export function useTodos() {
  const preloadedTodos = getPreloadedToolData('todos');
  const [todos, setTodos] = useState(() => sortTodos(normalizeTodos(preloadedTodos ?? [])));
  const [loading, setLoading] = useState(!preloadedTodos);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);
  const loadRequestRef = useRef(0);
  const pendingActionsRef = useRef(new Set());

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      pendingActionsRef.current.clear();
    };
  }, []);

  const safeSetTodos = useCallback((updater) => {
    if (!mountedRef.current) return;
    setTodos(updater);
  }, []);

  const loadTodos = useCallback(async ({ silent = false } = {}) => {
    const requestId = loadRequestRef.current + 1;
    loadRequestRef.current = requestId;

    try {
      if (mountedRef.current) {
        setError(null);
        if (!silent) {
          setLoading(true);
        }
      }

      const data = await getTodos();
      const sorted = sortTodos(normalizeTodos(data));

      if (!mountedRef.current || requestId !== loadRequestRef.current) return;

      setTodos(sorted);
      setPreloadedToolData('todos', sorted);
    } catch (e) {
      if (!mountedRef.current || requestId !== loadRequestRef.current) return;
      console.log('Fehler beim Laden der Todos:', e);
      setError('Todos konnten nicht geladen werden.');
    } finally {
      if (mountedRef.current && requestId === loadRequestRef.current && !silent) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    loadTodos({ silent: Boolean(preloadedTodos) });
  }, [loadTodos]);

  const completedCount = todos.filter(t => t.completed).length;
  const totalCount = todos.length;
  const progress = totalCount === 0 ? 0 : completedCount / totalCount;

  const toggle = useCallback(async (id, current) => {
    if (!id) return;

    const actionKey = `toggle:${id}`;
    if (pendingActionsRef.current.has(actionKey)) return;
    pendingActionsRef.current.add(actionKey);

    const next = !current;

    safeSetTodos(prev => {
      const nextTodos = sortTodos(prev.map(t =>
        t.id === id ? { ...t, completed: next } : t
      ));
      setPreloadedToolData('todos', nextTodos);
      return nextTodos;
    });

    try {
      await toggleTodo(id, next);
    } catch {
      safeSetTodos(prev => {
        const nextTodos = sortTodos(prev.map(t =>
          t.id === id ? { ...t, completed: current } : t
        ));
        setPreloadedToolData('todos', nextTodos);
        return nextTodos;
      });
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }, [safeSetTodos]);

  const remove = useCallback(async (id) => {
    if (!id) return;

    const actionKey = `delete:${id}`;
    if (pendingActionsRef.current.has(actionKey)) return;
    pendingActionsRef.current.add(actionKey);

    safeSetTodos(prev => {
      const nextTodos = prev.filter(t => t.id !== id);
      setPreloadedToolData('todos', nextTodos);
      return nextTodos;
    });

    try {
      await deleteTodo(id);
    } catch {
      await loadTodos();
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }, [loadTodos, safeSetTodos]);

  const add = useCallback(async (title, date) => {
    const safeTitle = typeof title === 'string' ? title.trim() : '';
    if (!safeTitle) return null;

    const newTodo = normalizeTodo(await addTodo(
      safeTitle,
      date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null
    ));

    if (!newTodo) return null;

    safeSetTodos(prev => {
      const nextTodos = sortTodos([...prev, newTodo]);
      setPreloadedToolData('todos', nextTodos);
      return nextTodos;
    });

    return newTodo;
  }, [safeSetTodos]);

  const update = useCallback(async (id, title, date) => {
    const safeTitle = typeof title === 'string' ? title.trim() : '';
    if (!id || !safeTitle) return null;

    const actionKey = `update:${id}`;
    if (pendingActionsRef.current.has(actionKey)) return null;
    pendingActionsRef.current.add(actionKey);

    try {
      const updatedTodo = normalizeTodo(await updateTodo(
        id,
        safeTitle,
        date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null
      ));

      if (!updatedTodo) return null;

      safeSetTodos(prev => {
        const nextTodos = sortTodos(prev.map(t =>
          t.id === id ? updatedTodo : t
        ));
        setPreloadedToolData('todos', nextTodos);
        return nextTodos;
      });

      return updatedTodo;
    } finally {
      pendingActionsRef.current.delete(actionKey);
    }
  }, [safeSetTodos]);

  return {
    todos,
    loading,
    error,
    completedCount,
    totalCount,
    progress,
    loadTodos,
    toggle,
    remove,
    add,
    update,
  };
}
