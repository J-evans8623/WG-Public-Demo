import React, { useState, useEffect, useContext } from 'react';
import { ApiContext, DriveFile } from '@/app/src/context/ApiContext';
import { Book, FileText, Plus, Clock } from 'lucide-react';

const HomeScreen = () => {
  const { listFiles } = useContext(ApiContext);
  const [recentFiles, setRecentFiles] = useState<DriveFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [greeting, setGreeting] = useState('');

  useEffect(() => {
    const getGreeting = () => {
      const hour = new Date().getHours();
      if (hour < 12) return 'Good morning';
      if (hour < 18) return 'Good afternoon';
      return 'Good evening';
    };
    setGreeting(getGreeting());
    fetchRecentFiles();
  }, []);

  const fetchRecentFiles = async () => {
    try {
      const files = await listFiles('');
      setRecentFiles(files);
    } catch (error) {
      console.error('Error fetching files:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">{greeting}</h1>
        <p className="text-gray-600">Welcome to your BloomMap workspace</p>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        {/* New Map Card */}
        <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Plus className="w-6 h-6 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold">New Map</h3>
              <p className="text-sm text-gray-600">Create a new concept map</p>
            </div>
          </div>
        </div>

        {/* Templates Card */}
        <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-green-100 rounded-lg">
              <Book className="w-6 h-6 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold">Templates</h3>
              <p className="text-sm text-gray-600">Start from a template</p>
            </div>
          </div>
        </div>

        {/* Learn Card */}
        <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-6">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-purple-100 rounded-lg">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h3 className="font-semibold">Learn</h3>
              <p className="text-sm text-gray-600">View tutorials</p>
            </div>
          </div>
        </div>
      </div>

      {/* Recent Files Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Recent Files
          </h2>
        </div>
        
        {loading ? (
          <div className="text-center py-8">Loading your files...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recentFiles.slice(0, 6).map((file: DriveFile) => (
              <div 
                key={file.id} 
                className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow cursor-pointer p-4"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-gray-100 rounded">
                    <FileText className="w-5 h-5 text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm mb-1 truncate">{file.name}</h3>
                    <p className="text-xs text-gray-500">
                      Modified: {file.modifiedTime ? new Date(file.modifiedTime).toLocaleDateString() : 'Unknown date'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default HomeScreen;
