import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { FileUploader } from './file-uploader';
import { AssetList } from './simplified-asset-list';
import { CompanyAssetList } from './company-asset-list';
import { CompanyAssetForm } from './company-asset-form';
import { AssetImport } from './asset-import';
import { CompanyAsset } from '@shared/schema';

export function AssetManager() {
  const [activeTab, setActiveTab] = useState("all");
  const [assetToEdit, setAssetToEdit] = useState<CompanyAsset | null>(null);

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    // Reset asset to edit when switching tabs
    if (value !== 'edit-company-asset') {
      setAssetToEdit(null);
    }
  };

  const handleEditAsset = (asset: CompanyAsset) => {
    setAssetToEdit(asset);
    setActiveTab('edit-company-asset');
  };

  return (
    <div className="container mx-auto py-8">
      <div className="space-y-4">
        <div>
          <h2 className="text-3xl font-bold tracking-tight">Asset Manager</h2>
          <p className="text-muted-foreground mt-2">Upload, manage, and share files and company assets across your organization</p>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-6">
        <TabsList className="grid w-full max-w-4xl grid-cols-5">
          <TabsTrigger value="all">Files</TabsTrigger>
          <TabsTrigger value="upload">Upload File</TabsTrigger>
          <TabsTrigger value="company-assets">Company Assets</TabsTrigger>
          <TabsTrigger value="add-company-asset">Add Asset</TabsTrigger>
          <TabsTrigger value="import-assets">Import Assets</TabsTrigger>
        </TabsList>
        
        <TabsContent value="all" className="mt-6">
          <AssetList />
        </TabsContent>
        
        <TabsContent value="upload" className="mt-6">
          <FileUploader />
        </TabsContent>

        <TabsContent value="company-assets" className="mt-6">
          <CompanyAssetList onEditAsset={handleEditAsset} />
        </TabsContent>
        
        <TabsContent value="add-company-asset" className="mt-6">
          <CompanyAssetForm onSuccess={() => setActiveTab('company-assets')} />
        </TabsContent>

        <TabsContent value="edit-company-asset" className="mt-6">
          {assetToEdit && (
            <>
              <h3 className="text-xl font-semibold mb-4">Edit Asset: {assetToEdit.name}</h3>
              <CompanyAssetForm 
                assetToEdit={assetToEdit} 
                onSuccess={() => setActiveTab('company-assets')} 
              />
            </>
          )}
        </TabsContent>

        <TabsContent value="import-assets" className="mt-6">
          <AssetImport />
        </TabsContent>
      </Tabs>
    </div>
  );
}