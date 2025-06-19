import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { 
  Sheet, 
  SheetContent, 
  SheetDescription, 
  SheetHeader, 
  SheetTitle, 
  SheetTrigger,
  SheetClose
} from '@/components/ui/sheet';
import { FileUploader } from './file-uploader';
import { AssetList } from './simplified-asset-list';
import { CompanyAssetList } from './company-asset-list';
import { CompanyAssetForm } from './company-asset-form';
import { AssetImport } from './asset-import';
import { CompanyAsset } from '@shared/schema';
import { Plus, Upload, FileUp } from 'lucide-react';

export function CompanyAssets() {
  const [activeTab, setActiveTab] = useState("assets");
  const [assetToEdit, setAssetToEdit] = useState<CompanyAsset | null>(null);
  const [addAssetMode, setAddAssetMode] = useState<'form' | 'import'>('form');

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
    <div className="container w-full px-4 sm:px-6 lg:px-8 mx-auto py-4 sm:py-6 lg:py-8">
      <div className="space-y-2 sm:space-y-4 w-full">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center w-full">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold tracking-tight">Asset Manager</h2>
            <p className="text-sm sm:text-base text-muted-foreground mt-1 sm:mt-2">Manage your organization's assets and files in one place</p>
          </div>
          {/* We'll add a quick action button here to improve navigation */}
          <Button 
            variant="outline"
            className="hidden sm:flex items-center gap-2 mt-2 sm:mt-0"
            onClick={() => {
              const tabsList = document.querySelector('[role="tablist"]');
              const addAssetTab = tabsList?.querySelector('[value="add-asset"]') as HTMLElement;
              if (addAssetTab) {
                addAssetTab.click();
              }
            }}
          >
            <Plus className="h-4 w-4" />
            Add New Asset
          </Button>
        </div>
      </div>
      
      <Tabs value={activeTab} onValueChange={handleTabChange} className="mt-4 sm:mt-6">
        <TabsList className="grid w-full max-w-md grid-cols-3">
          <TabsTrigger value="assets">Assets</TabsTrigger>
          <TabsTrigger value="add-asset" className="relative group">
            <Sheet>
              <SheetTrigger asChild className="w-full h-full">
                <div className="flex items-center justify-center gap-1">
                  <Plus className="h-4 w-4" />
                  <span>Add / Import</span>
                </div>
              </SheetTrigger>
              <SheetContent side="right" className="sm:max-w-lg w-full overflow-auto">
                <SheetHeader className="mb-6">
                  <SheetTitle>Add Assets</SheetTitle>
                  <SheetDescription>
                    Add a single asset or import multiple assets from a spreadsheet
                  </SheetDescription>
                </SheetHeader>
                
                <div className="flex border-b mb-4">
                  <Button 
                    variant={addAssetMode === 'form' ? 'default' : 'ghost'} 
                    onClick={() => setAddAssetMode('form')}
                    className="rounded-none rounded-t-md"
                  >
                    Add Single Asset
                  </Button>
                  <Button 
                    variant={addAssetMode === 'import' ? 'default' : 'ghost'} 
                    onClick={() => setAddAssetMode('import')}
                    className="rounded-none rounded-t-md"
                  >
                    Import Assets
                  </Button>
                </div>
                
                {addAssetMode === 'form' ? (
                  <CompanyAssetForm 
                    onSuccess={() => {
                      setActiveTab('assets');
                      const closeButton = document.querySelector('.close-add-asset-sheet') as HTMLElement;
                      if (closeButton) closeButton.click();
                    }} 
                  />
                ) : (
                  <AssetImport />
                )}
                
                <div className="mt-4 text-right">
                  <SheetClose className="close-add-asset-sheet">
                    <Button variant="outline">Close</Button>
                  </SheetClose>
                </div>
              </SheetContent>
            </Sheet>
          </TabsTrigger>
          <TabsTrigger value="files">Files</TabsTrigger>
        </TabsList>
        
        <TabsContent value="assets" className="mt-6">
          <CompanyAssetList onEditAsset={handleEditAsset} />
        </TabsContent>
        
        <TabsContent value="files" className="mt-6">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-xl font-bold">Files</h3>
            <Button variant="default" className="gap-2">
              <FileUp className="h-4 w-4" />
              Upload File
            </Button>
          </div>
          <AssetList />
        </TabsContent>

        <TabsContent value="edit-company-asset" className="mt-6">
          {assetToEdit && (
            <>
              <h3 className="text-xl font-semibold mb-4">Edit Asset: {assetToEdit.name}</h3>
              <CompanyAssetForm 
                assetToEdit={assetToEdit} 
                onSuccess={() => setActiveTab('assets')} 
              />
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}