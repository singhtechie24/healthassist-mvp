import { Link } from 'react-router-dom';

export default function About() {
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

      {/* About Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-8">About HealthAssist</h1>
          
          <div className="prose prose-lg max-w-none">
            
            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Mission</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                HealthAssist is designed to make health information more accessible and help people better understand and manage their wellness journey. We believe everyone deserves easy access to reliable health guidance and tools to track their progress.
              </p>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">What We Do</h2>
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-6">
                  <h3 className="font-semibold text-emerald-900 mb-2">🤖 AI Health Conversations</h3>
                  <p className="text-emerald-800 text-sm">
                    Get instant answers to health questions with our intelligent AI that remembers your preferences and provides personalized guidance.
                  </p>
                </div>
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <h3 className="font-semibold text-blue-900 mb-2">📊 Wellness Tracking</h3>
                  <p className="text-blue-800 text-sm">
                    Track your mood, symptoms, and health patterns over time with beautiful charts and insights.
                  </p>
                </div>
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-6">
                  <h3 className="font-semibold text-purple-900 mb-2">🔔 Smart Reminders</h3>
                  <p className="text-purple-800 text-sm">
                    Never miss medications or appointments with intelligent reminders that adapt to your schedule.
                  </p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                  <h3 className="font-semibold text-red-900 mb-2">🆘 Emergency Practice</h3>
                  <p className="text-red-800 text-sm">
                    Practice emergency scenarios to build confidence and know what to do in critical situations.
                  </p>
                </div>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Our Approach</h2>
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6">
                <ul className="space-y-3 text-gray-700">
                  <li><strong>Education First:</strong> We provide information to help you make informed decisions about your health</li>
                  <li><strong>Privacy Focused:</strong> Your health data belongs to you. We protect it and give you full control</li>
                  <li><strong>Accessible:</strong> 20 free AI conversations available without any account required</li>
                  <li><strong>Evidence-Based:</strong> Our guidance is based on reliable health information and best practices</li>
                </ul>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Technology</h2>
              <p className="text-gray-700 leading-relaxed mb-4">
                HealthAssist is built with modern web technologies including React, TypeScript, and Firebase. Our AI is powered by OpenAI's advanced language models, specifically trained to provide helpful health guidance while maintaining appropriate boundaries.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">React</span>
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">TypeScript</span>
                <span className="bg-orange-100 text-orange-800 px-3 py-1 rounded-full text-sm">Firebase</span>
                <span className="bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">OpenAI</span>
                <span className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">Tailwind CSS</span>
              </div>
            </section>

            <section className="mb-8">
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Important Disclaimer</h2>
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-6">
                <p className="text-amber-800 font-medium mb-2">⚠️ For Educational Purposes Only</p>
                <p className="text-amber-700 leading-relaxed">
                  HealthAssist is designed for educational and informational purposes only. It is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of qualified healthcare providers with any questions you may have regarding medical conditions. Never disregard professional medical advice or delay seeking it because of information provided by HealthAssist.
                </p>
              </div>
            </section>

            <section>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">Get Started</h2>
              <p className="text-gray-700 mb-6">
                Ready to begin your health journey? Start with 20 free AI conversations, no account required.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link 
                  to="/chat"
                  className="bg-emerald-500 text-white px-6 py-3 rounded-lg hover:bg-emerald-600 font-medium transition-colors text-center"
                >
                  Try AI Chat Now
                </Link>
                <Link 
                  to="/login"
                  className="bg-white text-emerald-600 px-6 py-3 rounded-lg hover:bg-emerald-50 font-medium border-2 border-emerald-500 transition-colors text-center"
                >
                  Create Account
                </Link>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}


