import React from 'react';
import { ToastContainer, toast, Slide } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';

// Custom toast component with Lucide icons
export const Toast = () => {
  return (
    <ToastContainer
      position="top-right"
      autoClose={3000}
      hideProgressBar={false}
      newestOnTop
      closeOnClick
      rtl={false}
      pauseOnFocusLoss
      draggable
      pauseOnHover
      theme="light"
      transition={Slide}
    />
  );
};

// Toast notification functions
export const showSuccessToast = (message: string) => {
  toast.success(
    <div className="flex items-center space-x-2">
      <CheckCircle className="h-5 w-5 text-green-500" />
      <span>{message}</span>
    </div>
  );
};

export const showErrorToast = (message: string) => {
  toast.error(
    <div className="flex items-center space-x-2">
      <XCircle className="h-5 w-5 text-red-500" />
      <span>{message}</span>
    </div>
  );
};

export const showWarningToast = (message: string) => {
  toast.warning(
    <div className="flex items-center space-x-2">
      <AlertTriangle className="h-5 w-5 text-amber-500" />
      <span>{message}</span>
    </div>
  );
};

export const showInfoToast = (message: string) => {
  toast.info(
    <div className="flex items-center space-x-2">
      <Info className="h-5 w-5 text-blue-500" />
      <span>{message}</span>
    </div>
  );
};