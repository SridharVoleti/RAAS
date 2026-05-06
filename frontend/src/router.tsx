import { createBrowserRouter, Navigate } from 'react-router-dom'

import AppLayout from './ui/AppLayout'
import AdminCourseDetailPage from './ui/AdminCourseDetailPage'
import AdminCoursesPage from './ui/AdminCoursesPage'
import AdminImportPage from './ui/AdminImportPage'
import BlogArticlePage from './ui/BlogArticlePage'
import BlogEditorPage from './ui/BlogEditorPage'
import BlogListPage from './ui/BlogListPage'
import CoursePlayerPage from './ui/CoursePlayerPage'
import DashboardPage from './ui/DashboardPage'
import HomePage from './ui/HomePage'
import LearningPathsPage from './ui/LearningPathsPage'
import LoginPage from './ui/LoginPage'

export const router = createBrowserRouter([
  {
    path: '/',
    element: <HomePage />,
  },
  {
    path: '/login',
    element: <LoginPage />,
  },
  {
    path: '/blog',
    element: <BlogListPage />,
  },
  {
    path: '/blog/new',
    element: <BlogEditorPage />,
  },
  {
    path: '/blog/:articleId',
    element: <BlogArticlePage />,
  },
  {
    path: '/app',
    element: <AppLayout />,
    children: [
      { index: true, element: <Navigate to="/app/dashboard" replace /> },
      { path: 'dashboard', element: <DashboardPage /> },
      { path: 'learning-paths', element: <LearningPathsPage /> },
      { path: 'admin/import', element: <AdminImportPage /> },
      { path: 'admin/courses', element: <AdminCoursesPage /> },
      { path: 'admin/course/:courseId', element: <AdminCourseDetailPage /> },
      { path: 'course/:courseId', element: <CoursePlayerPage /> },
    ],
  },
])
