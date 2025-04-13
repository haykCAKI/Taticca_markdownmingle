import React, { useEffect, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiRequest } from '@/lib/queryClient';
import { useLocation } from 'wouter';
import { Document, InsertDocument } from '@shared/schema';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader, Plus, FileText } from 'lucide-react';
import { formatRelativeTime } from '@/lib/time-utils';

export default function Home() {
  const queryClient = useQueryClient();
  const [_, navigate] = useLocation();
  
  // Fetch all documents
  const { data: documents, isLoading, error } = useQuery<Document[]>({
    queryKey: ['/api/documents'],
  });
  
  // Create new document mutation
  const createDocument = useMutation({
    mutationFn: async (document: InsertDocument) => {
      const response = await apiRequest('POST', '/api/documents', document);
      return response.json();
    },
    onSuccess: (newDocument: Document) => {
      queryClient.invalidateQueries({ queryKey: ['/api/documents'] });
      navigate(`/repldocs/${newDocument.id}`);
    },
  });
  
  const handleCreateNewDocument = () => {
    createDocument.mutate({
      title: 'Untitled Document',
      content: '',
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-white border-b border-gray-200 py-4 px-6 shadow-sm">
        <div className="max-w-6xl mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold text-primary">Markdown Collaboration Platform</h1>
          <Button onClick={handleCreateNewDocument} disabled={createDocument.isPending}>
            <Plus className="h-4 w-4 mr-1" />
            New Document
          </Button>
        </div>
      </header>
      
      <main className="flex-1 py-8">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">Your Documents</h2>
          </div>
          
          {isLoading ? (
            <div className="flex justify-center py-12">
              <Loader className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <Card className="bg-red-50 border-red-200">
              <CardContent className="pt-6">
                <p>Error loading documents. Please try again.</p>
              </CardContent>
            </Card>
          ) : documents && documents.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {documents.map((doc) => (
                <Card key={doc.id} className="hover:shadow-md transition-shadow cursor-pointer" onClick={() => navigate(`/repldocs/${doc.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1 min-w-0">
                        <h3 className="text-lg font-medium text-gray-900 truncate">{doc.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          Last edited {formatRelativeTime(doc.updated_at)}
                        </p>
                      </div>
                      <FileText className="h-5 w-5 text-gray-400 flex-shrink-0 ml-2" />
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="py-12 text-center">
                <FileText className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No documents yet</h3>
                <p className="text-gray-500 mb-6">Create your first Markdown document to get started</p>
                <Button onClick={handleCreateNewDocument} disabled={createDocument.isPending}>
                  <Plus className="h-4 w-4 mr-1" />
                  Create Document
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 py-4 px-6">
        <div className="max-w-6xl mx-auto text-center text-sm text-gray-500">
          Markdown Collaboration Platform © {new Date().getFullYear()}
        </div>
      </footer>
    </div>
  );
}
