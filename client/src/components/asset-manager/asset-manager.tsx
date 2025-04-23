import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUploader } from './file-uploader';
import { AssetList } from './simplified-asset-list';

export function AssetManager() {
  return (
    <div className="container mx-auto py-8">
      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Asset Manager</h2>
          <p className="text-muted-foreground mt-2">Upload, manage, and share files across your organization</p>
        </div>
      </div>
      
      <Tabs defaultValue="all" className="mt-6">
        <TabsList className="grid w-full max-w-md grid-cols-2">
          <TabsTrigger value="all">All Files</TabsTrigger>
          <TabsTrigger value="upload">Upload File</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          <AssetList />
        </TabsContent>
        
        <TabsContent value="upload" className="mt-6">
          <FileUploader />
        </TabsContent>
      </Tabs>
    </div>
  );
}