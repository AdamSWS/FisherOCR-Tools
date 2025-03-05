// InDesign JPG Export Script
// This script exports InDesign pages as JPGs at specified pixel dimensions
// Modified to focus only on exporting JPGs to ocr_data folder

try {
    if (app.documents.length === 0) {
        throw new Error("No document is open. Please open an InDesign document first.");
    }
    
    var doc = app.activeDocument;
    
    // Prompt user for document dimensions
    var dimensionsDialog = app.dialogs.add({name: "Document Export Dimensions"});
    
    // Add column
    var column = dimensionsDialog.dialogColumns.add();
    
    // Width input
    var widthGroup = column.dialogRows.add();
    widthGroup.staticTexts.add({staticLabel: "Document Width (px):"});
    var widthField = widthGroup.integerEditboxes.add({editValue: 2550}); // Default value
    
    // Height input
    var heightGroup = column.dialogRows.add();
    heightGroup.staticTexts.add({staticLabel: "Document Height (px):"});
    var heightField = heightGroup.integerEditboxes.add({editValue: 3300}); // Default value
    
    // Show the dialog
    if (dimensionsDialog.show()) {
        // Get user input
        var docWidth = parseInt(widthField.editValue);
        var docHeight = parseInt(heightField.editValue);
        
        // Destroy the dialog
        dimensionsDialog.destroy();
    } else {
        // User cancelled
        dimensionsDialog.destroy();
        throw new Error("Operation cancelled by user.");
    }
    
    // Create output folder on desktop
    var desktopPath = Folder.desktop.fsName;
    var ocrDataFolder = new Folder(desktopPath + "/ocr_data");
    
    // Create the folder if it doesn't exist
    if (!ocrDataFolder.exists) {
        ocrDataFolder.create();
    }
    
    // Calculate the appropriate DPI to achieve the exact pixel dimensions
    var currentPage = doc.pages[0];
    var docPageWidth = currentPage.bounds[3] - currentPage.bounds[1]; // Width in points (72 dpi)
    var docPageHeight = currentPage.bounds[2] - currentPage.bounds[0]; // Height in points (72 dpi)
    
    // Calculate the resolution needed to get the exact pixel dimensions
    // Formula: resolution = (desired pixel width / document width in points) * 72
    var exportResolution = Math.round((docWidth / docPageWidth) * 72);
    
    // Verify the calculation is accurate
    var calculatedWidth = Math.round((docPageWidth / 72) * exportResolution);
    var calculatedHeight = Math.round((docPageHeight / 72) * exportResolution);
    
    // If there's a significant discrepancy, adjust the resolution
    if (Math.abs(calculatedWidth - docWidth) > 2 || Math.abs(calculatedHeight - docHeight) > 2) {
        // Try to find a resolution that produces dimensions closer to the desired ones
        var bestResolution = exportResolution;
        var bestDiff = Math.abs(calculatedWidth - docWidth) + Math.abs(calculatedHeight - docHeight);
        
        // Try a few values around the calculated resolution
        for (var r = exportResolution - 5; r <= exportResolution + 5; r++) {
            var testWidth = Math.round((docPageWidth / 72) * r);
            var testHeight = Math.round((docPageHeight / 72) * r);
            var diff = Math.abs(testWidth - docWidth) + Math.abs(testHeight - docHeight);
            
            if (diff < bestDiff) {
                bestDiff = diff;
                bestResolution = r;
            }
        }
        
        exportResolution = bestResolution;
        calculatedWidth = Math.round((docPageWidth / 72) * exportResolution);
        calculatedHeight = Math.round((docPageHeight / 72) * exportResolution);
    }
    
    // Add a dialog to inform the user about the actual export dimensions
    var infoDialog = app.dialogs.add({name: "Export Information"});
    var infoColumn = infoDialog.dialogColumns.add();
    
    // Info text
    var infoText = "Document will be exported with the following settings:\n" +
                  "Pixel dimensions: " + docWidth + " x " + docHeight + " pixels\n" +
                  "Resolution: " + exportResolution + " DPI\n" +
                  "Actual export dimensions: approximately " + calculatedWidth + " x " + calculatedHeight + " pixels";
    
    if (Math.abs(calculatedWidth - docWidth) > 2 || Math.abs(calculatedHeight - docHeight) > 2) {
        infoText += "\n\nNote: Due to InDesign's export limitations, the exact pixel dimensions of " + 
                    docWidth + " x " + docHeight + " cannot be achieved precisely.";
    }
    
    infoColumn.staticTexts.add({staticLabel: infoText});
    
    // Show the dialog
    if (infoDialog.show()) {
        infoDialog.destroy();
    } else {
        infoDialog.destroy();
        throw new Error("Operation cancelled by user.");
    }
    
    // Process each page of the document
    var pageCount = doc.pages.length;
    var processedJpgs = [];
    
    for (var pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        // Set up JPG export with document name and page number
        var jpgBaseName = doc.name.replace(/\.indd$/i, "") + "_page" + (pageIndex + 1) + ".jpg";
        var jpgPathOnDisk = ocrDataFolder.fsName + "/" + jpgBaseName;
        
        // Export current page as JPG
        try {
            // Set up basic export preferences
            app.jpegExportPreferences.jpegQuality = JPEGOptionsQuality.MAXIMUM;
            app.jpegExportPreferences.exportResolution = exportResolution;
            app.jpegExportPreferences.jpegExportRange = ExportRangeOrAllPages.EXPORT_RANGE;
            app.jpegExportPreferences.pageString = (pageIndex + 1).toString(); // Export current page
            
            // Set consistent scaling preferences to maintain exact dimensions
            app.jpegExportPreferences.antiAlias = true;
            app.jpegExportPreferences.embedColorProfile = false;
            app.jpegExportPreferences.simulateOverprint = false; // Disable to maintain consistent output
            app.jpegExportPreferences.useDocumentBleeds = false; // Ensures exact document dimensions
            
            // Force specific image dimensions if possible
            try {
                // Some versions of InDesign support these properties
                app.jpegExportPreferences.jpegRenderingStyle = JPEGOptionsFormat.PROGRESSIVE_ENCODING;
                app.jpegExportPreferences.exportingSpread = false;
            } catch (err) {
                // Ignore if these properties aren't supported
            }
            
            // Export as JPG
            doc.exportFile(ExportFormat.JPG, new File(jpgPathOnDisk), false);
            processedJpgs.push(jpgBaseName);
        } catch (e) {
            alert("Error exporting JPG for page " + (pageIndex + 1) + ": " + e.message + 
                  "\nPlease manually export your document page as JPG to: " + jpgPathOnDisk);
        }
    }
    
    // Build success message
    var successMsg = "Export complete!\n\n" + 
                     "JPGs saved to: " + ocrDataFolder.fsName + "\n" +
                     "Files created: ";
    
    // Add list of JPGs created
    if (processedJpgs.length > 0) {
        successMsg += processedJpgs.join(", ");
    } else {
        successMsg += "None";
    }
    
    successMsg += "\n\nProcessed " + pageCount + " pages at " + exportResolution + " dpi\n" +
                  "Requested dimensions: " + docWidth + " x " + docHeight + " pixels\n" +
                  "Actual export dimensions: " + calculatedWidth + " x " + calculatedHeight + " pixels";
    
    alert(successMsg);
    
} catch (error) {
    alert("Error: " + error.message);
}