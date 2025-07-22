export default function AuthCodeError() {
  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-900 text-white">
      <div className="w-full max-w-md p-8 space-y-6 bg-gray-800 rounded-lg">
        <h1 className="text-2xl font-bold text-center">Authentication Error</h1>
        <p className="text-center">
          There was an error during the authentication process. Please try again.
        </p>
      </div>
    </div>
  );
} 