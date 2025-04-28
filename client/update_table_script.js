const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'src/pages/appointment-master.tsx');
const fileContent = fs.readFileSync(filePath, 'utf8');

// Function to process a single row
function processRow(rowMatch) {
    // Get the field name to determine if it's a special field
    const fieldNameMatch = rowMatch.match(/<TableCell>(.*?)<\/TableCell>/);
    const fieldName = fieldNameMatch ? fieldNameMatch[1] : '';
    
    // Check if this row already has both "Included" and "Is Required" columns
    if (rowMatch.includes('<TableCell className="text-center">\n                            <Checkbox checked={true} disabled />') && 
        rowMatch.includes('<TableCell className="text-center">\n                            <Checkbox checked={true} disabled />')) {
        return rowMatch; // Already has both columns
    }
    
    // Special case for BOL Doc and BOL Identifier
    if (fieldName === 'BOL Doc' || fieldName === 'BOL Identifier') {
        // These fields have checkboxes but need to be formatted differently
        const includeCheckbox = `<TableCell className="text-center">
                            <Checkbox 
                              checked={true} 
                              onCheckedChange={(checked) => {
                                // In a real implementation, this would update the field configuration
                                toast({
                                  description: "${fieldName} included setting updated",
                                });
                              }}
                            />
                          </TableCell>`;
        
        // Only replace if there's one checkbox (assuming it's for "Required")
        if ((rowMatch.match(/<TableCell className="text-center">/g) || []).length === 1) {
            return rowMatch.replace(
                /<\/TableCell>\s*<\/TableRow>/,
                `</TableCell>${includeCheckbox}</TableRow>`
            );
        }
    } 
    
    // For regular rows, add "Is Required" checkbox if not already present
    if ((rowMatch.match(/<TableCell className="text-center">/g) || []).length === 1) {
        return rowMatch.replace(
            /<\/TableCell>\s*<\/TableRow>/,
            `</TableCell>
                          <TableCell className="text-center">
                            <Checkbox checked={true} disabled />
                          </TableCell>
                        </TableRow>`
        );
    }
    
    return rowMatch;
}

// Find all table rows
const tableRowPattern = /<TableRow>[\s\S]+?<\/TableRow>/g;
let updatedContent = fileContent;
let match;

// Process each table row
while ((match = tableRowPattern.exec(fileContent)) !== null) {
    const originalRow = match[0];
    const processedRow = processRow(originalRow);
    
    if (originalRow !== processedRow) {
        updatedContent = updatedContent.replace(originalRow, processedRow);
    }
}

// Save the updated file
fs.writeFileSync(filePath + '.updated', updatedContent);
console.log('Updated file has been saved as appointment-master.tsx.updated');
