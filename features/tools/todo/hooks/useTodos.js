import { useState, useEffect, useCallback } from 'react';
import {
  getTodos,
  addTodo,
  toggleTodo,
  deleteTodo,
  updateTodo,
} from '../services/todo';
import { sortTodos } from '../utils/todoUtils';
import { getPreloadedToolData, setPreloadedToolData } from '../../../../lib/preloadedTools';

export function useTodos() {
  const preloadedTodos = getPreloadedToolData('todos');
  const [todos, setTodos] = useState(() => sortTodos(preloadedTodos ?? []));
  const [loading, setLoading] = useState(!preloadedTodos);
  const [error, setError] = useState(null);

  const loadTodos = useCallback(async ({ silent = false } = {}) => {
    try {
      setError(null);
      if (!silent) {
        setLoading(true);
      }

      const data = await getTodos();
      const sorted = sortTodos(data);
      setTodos(sorted);
      setPreloadedToolData('todos', sorted);
    } catch (e) {
      console.log('Fehler beim Laden der Todos:', e);
      setError('Todos konnten nicht geladen werden.');
    } finally {
      if (!silent) {
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
    const next = !current;

    setTodos(prev => {
      const nextTodos = sortTodos(prev.map(t =>
        t.id === id ? { ...t, completed: next } : t
      ));
      setPreloadedToolData('todos', nextTodos);
      return nextTodos;
    });

    try {
      await toggleTodo(id, next);
    } catch {
      setTodos(prev => {
        const nextTodos = sortTodos(prev.map(t =>
          t.id === id ? { ...t, completed: current } : t
        ));
        setPreloadedToolData('todos', nextTodos);
        return nextTodos;
      });
    }
  }, []);

  const remove = useCallback(async (id) => {
    setTodos(prev => {
      const nextTodos = prev.filter(t => t.id !== id);
      setPreloadedToolData('todos', nextTodos);
      return nextTodos;
    });

    try {
      await deleteTodo(id);
    } catch {
      loadTodos();
    }
  }, [loadTodos]);

  const add = useCallback(async (title, date) => {
    const newTodo = await addTodo(
      title,
      date ? date.toISOString() : null
    );

    setTodos(prev => {
      const nextTodos = sortTodos([...prev, newTodo]);
      setPreloadedToolData('todos', nextTodos);
      return nextTodos;
    });
  }, []);

  const update = useCallback(async (id, title, date) => {
    const updatedTodo = await updateTodo(
      id,
      title,
      date ? date.toISOString() : null
    );

    setTodos(prev => {
      const nextTodos = sortTodos(prev.map(t =>
        t.id === id ? updatedTodo : t
      ));
      setPreloadedToolData('todos', nextTodos);
      return nextTodos;
    });
  }, []);

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