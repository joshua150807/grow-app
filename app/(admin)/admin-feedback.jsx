import AdminProtectedRoute from '../../features/admin/components/AdminProtectedRoute';
import AdminFeedbackScreen from '../../features/admin/screens/AdminFeedbackScreen';

export default function AdminFeedbackRoute() {
  return (
    <AdminProtectedRoute>
      <AdminFeedbackScreen />
    </AdminProtectedRoute>
  );
}
