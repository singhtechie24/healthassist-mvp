import { Link } from 'react-router-dom';

export default function Privacy() {
  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navigation Header */}
      <nav className="bg-white shadow-sm">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <Link to="/" className="flex items-center space-x-3">
              <img 
                src="/logo.png" 
                alt="HealthAssist Logo" 
                className="w-8 h-8 object-contain"
              />
              <span className="text-xl font-bold text-emerald-600">HealthAssist</span>
            </Link>
            
            <Link 
              to="/"
              className="text-gray-600 hover:text-emerald-600 font-medium transition-colors"
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </nav>

      {/* Privacy Policy Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">Privacy Policy</h1>
          
          <div className="prose prose-lg max-w-none">
            <p className="text-gray-600 mb-6">
              <strong>Last updated:</strong> {new Date().toLocaleDateString()}
            </p>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Privacy Matters</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                HealthAssist is committed to protecting your privacy and ensuring you have control over your personal health information. This privacy policy explains how we collect, use, and protect your data.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Information We Collect</h2>
              <div className="space-y-4 text-gray-700">
                <div>
                  <h3 className="font-semibold mb-2">Account Information</h3>
                  <p>When you create an account, we collect your email address and authentication data.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Health Data</h3>
                  <p>Mood logs, medication reminders, and chat conversations you choose to save.</p>
                </div>
                <div>
                  <h3 className="font-semibold mb-2">Usage Data</h3>
                  <p>How you interact with our features to improve your experience.</p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">How We Use Your Information</h2>
              <ul className="list-disc pl-6 space-y-2 text-gray-700">
                <li>Provide personalized AI health guidance</li>
                <li>Track your mood and wellness patterns</li>
                <li>Send medication reminders</li>
                <li>Improve our AI responses based on your interactions</li>
                <li>Ensure the security and functionality of our service</li>
              </ul>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Your Rights</h2>
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li><strong>Access:</strong> View all data we have about you</li>
                  <li><strong>Delete:</strong> Permanently remove your account and all data</li>
                  <li><strong>Export:</strong> Download your data in a readable format</li>
                  <li><strong>Anonymous Use:</strong> Use 20 free chats without an account</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Data Security</h2>
              <p className="text-gray-700 leading-relaxed">
                Your data is encrypted in transit and at rest. We use Firebase's secure infrastructure and follow industry best practices for data protection. We never share your personal health information with third parties.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Educational Purpose Disclaimer</h2>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                <p className="text-amber-800 font-medium mb-2">⚠️ Important Notice</p>
                <p className="text-amber-700">
                  HealthAssist is for educational purposes only and is not a substitute for professional medical advice, diagnosis, or treatment. Always consult qualified healthcare providers for medical concerns.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Contact Us</h2>
              <p className="text-gray-700">
                If you have questions about this privacy policy or your data, please contact us through the app settings or visit our support page.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}


