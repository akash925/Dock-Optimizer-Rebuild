import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';

interface EmailTemplate {
  subject?: string;
  headerText?: string;
  footerText?: string;
  includeQrCode?: boolean;
  includeCalendarAttachment?: boolean;
  hoursBeforeReminder?: number;
}

interface EmailTemplateEditorProps {
  template: EmailTemplate;
  onTemplateChange: (template: EmailTemplate) => void;
  onSave: () => void;
  isSaving: boolean;
}

export function EmailTemplateEditor({ template, onTemplateChange, onSave, isSaving }: EmailTemplateEditorProps) {
  const handleFieldChange = (field: keyof EmailTemplate, value: any) => {
    onTemplateChange({ ...template, [field]: value });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Email Template</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="subject">Email Subject</Label>
          <Input
            id="subject"
            value={template.subject || ''}
            onChange={(e) => handleFieldChange('subject', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="headerText">Header Message</Label>
          <Textarea
            id="headerText"
            value={template.headerText || ''}
            onChange={(e) => handleFieldChange('headerText', e.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="footerText">Footer Text</Label>
          <Textarea
            id="footerText"
            value={template.footerText || ''}
            onChange={(e) => handleFieldChange('footerText', e.target.value)}
          />
        </div>
        <div className="flex justify-end">
          <Button onClick={onSave} disabled={isSaving}>
            {isSaving ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <Save className="h-4 w-4 mr-2" />
            )}
            Save Template
          </Button>
        </div>
      </CardContent>
    </Card>
  );
} 