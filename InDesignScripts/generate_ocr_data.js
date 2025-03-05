// InDesign Text Extraction for OCR Training with Coordinate Scaling
// This script extracts text content and coordinates for OCR training
// Supporting multiple pages, proper appending, and original coordinate handling

try {
    if (app.documents.length === 0) {
        throw new Error("No document is open. Please open an InDesign document first.");
    }
    
    var doc = app.activeDocument;
    
    // Create output folder on desktop
    var desktopPath = Folder.desktop.fsName;
    var ocrDataFolder = new Folder(desktopPath + "/ocr_data");
    
    // Create the folder if it doesn't exist
    if (!ocrDataFolder.exists) {
        ocrDataFolder.create();
    }
    
    // Set up export resolution (this affects scaling)
    var exportResolution = 150; // DPI
    
    // Calculate scaling factor based on resolution
    // InDesign's native resolution is 72dpi, so the scaling factor is exportResolution/72
    var scaleFactor = exportResolution / 72;
    
    // Create output files - using "a" mode for appending
    var labelFile = new File(ocrDataFolder.fsName + "/Label.txt");
    var cacheFile = new File(ocrDataFolder.fsName + "/Cache.cach");
    var fileStateFile = new File(ocrDataFolder.fsName + "/fileState.txt");
    
    // Check if files exist and get their length
    var labelExists = labelFile.exists;
    var cacheExists = cacheFile.exists;
    var fileStateExists = fileStateFile.exists;
    
    // Open files for appending
    labelFile.encoding = "UTF-8";
    labelFile.open("a");
    
    cacheFile.encoding = "UTF-8";
    cacheFile.open("a");
    
    fileStateFile.encoding = "UTF-8";
    fileStateFile.open("a");
    
    // Check if files have content already and if they end with a newline
    var labelHasContent = false;
    var cacheHasContent = false;
    var fileStateHasContent = false;
    
    // If the files exist, check if they have content and if they end with a newline
    if (labelExists && labelFile.length > 0) {
        labelHasContent = true;
        // Check if the file ends with a newline
        labelFile.close();
        var tempLabelFile = new File(ocrDataFolder.fsName + "/Label.txt");
        tempLabelFile.encoding = "UTF-8";
        tempLabelFile.open("r");
        var labelContent = tempLabelFile.read();
        tempLabelFile.close();
        if (labelContent.length > 0 && labelContent.charAt(labelContent.length - 1) !== "\n") {
            // If the file doesn't end with a newline, we'll need to add one
            labelFile.open("a");
            labelFile.write("\n");
        } else {
            labelFile.open("a");
        }
    } else {
        labelFile.open("a");
    }
    
    if (cacheExists && cacheFile.length > 0) {
        cacheHasContent = true;
        // Check if the file ends with a newline
        cacheFile.close();
        var tempCacheFile = new File(ocrDataFolder.fsName + "/Cache.cach");
        tempCacheFile.encoding = "UTF-8";
        tempCacheFile.open("r");
        var cacheContent = tempCacheFile.read();
        tempCacheFile.close();
        if (cacheContent.length > 0 && cacheContent.charAt(cacheContent.length - 1) !== "\n") {
            // If the file doesn't end with a newline, we'll need to add one
            cacheFile.open("a");
            cacheFile.write("\n");
        } else {
            cacheFile.open("a");
        }
    } else {
        cacheFile.open("a");
    }
    
    if (fileStateExists && fileStateFile.length > 0) {
        fileStateHasContent = true;
        // Check if the file ends with a newline
        fileStateFile.close();
        var tempFileStateFile = new File(ocrDataFolder.fsName + "/fileState.txt");
        tempFileStateFile.encoding = "UTF-8";
        tempFileStateFile.open("r");
        var fileStateContent = tempFileStateFile.read();
        tempFileStateFile.close();
        if (fileStateContent.length > 0 && fileStateContent.charAt(fileStateContent.length - 1) !== "\n") {
            // If the file doesn't end with a newline, we'll need to add one
            fileStateFile.open("a");
            fileStateFile.write("\n");
        } else {
            fileStateFile.open("a");
        }
    } else {
        fileStateFile.open("a");
    }
    
    // Process each page
    var pageCount = doc.pages.length;
    var processedJpgs = [];
    
    for (var pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        // Set up JPG export with document name and page number
        var jpgBaseName = doc.name.replace(/\.indd$/i, "") + "_page" + (pageIndex + 1) + ".jpg";
        var jpgPathOnDisk = ocrDataFolder.fsName + "/" + jpgBaseName;
        
        // For file references in Label.txt and fileState.txt, include the folder name
        var jpgPathForLabels = "ocr_data/" + jpgBaseName;
        
        // Get document dimensions for this page (used for scaling)
        var currentPage = doc.pages[pageIndex];
        var docWidth = (currentPage.bounds[3] - currentPage.bounds[1]) * 72; // Convert to points
        var docHeight = (currentPage.bounds[2] - currentPage.bounds[0]) * 72; // Convert to points
        
        // Export current page as JPG
        try {
            // Set up basic export preferences
            app.jpegExportPreferences.jpegQuality = JPEGOptionsQuality.MAXIMUM;
            app.jpegExportPreferences.exportResolution = exportResolution;
            app.jpegExportPreferences.jpegExportRange = ExportRangeOrAllPages.EXPORT_RANGE;
            app.jpegExportPreferences.pageString = (pageIndex + 1).toString(); // Export current page
            
            // Export as JPG
            doc.exportFile(ExportFormat.JPG, new File(jpgPathOnDisk), false);
            processedJpgs.push(jpgBaseName);
        } catch (e) {
            alert("Error exporting JPG for page " + (pageIndex + 1) + ": " + e.message + 
                  "\nPlease manually export your document page as JPG to: " + jpgPathOnDisk);
        }
        
        // Store text boxes with their coordinates for this page
        var textBoxes = [];
        
        // Get all text frames on this specific page
        for (var i = 0; i < doc.stories.length; i++) {
            var story = doc.stories[i];
            var storyContent = story.contents;
            
            // Check if story has content
            if (storyContent && storyContent.toString().replace(/\s/g, '').length > 0) {
                // Process each text frame in this story
                for (var j = 0; j < story.textContainers.length; j++) {
                    var textFrame = story.textContainers[j];
                    
                    try {
                        // Check if this frame is on the current page (not on pasteboard or another page)
                        var parentPage = null;
                        try {
                            parentPage = textFrame.parentPage;
                            // Skip if not on a page or not on the current page
                            if (!parentPage || parentPage !== currentPage) continue;
                        } catch (e) {
                            continue; // Skip frames not on a page
                        }
                        
                        // Get geometric bounds [y1, x1, y2, x2] - InDesign uses this unusual order
                        var bounds = textFrame.geometricBounds;
                        
                        // Convert to points and apply scaling (like the original script)
                        var yMin = Math.round(bounds[0] * 72 * scaleFactor);
                        var xMin = Math.round(bounds[1] * 72 * scaleFactor);
                        var yMax = Math.round(bounds[2] * 72 * scaleFactor);
                        var xMax = Math.round(bounds[3] * 72 * scaleFactor);
                        
                        // Get text in this specific frame
                        var frameText = textFrame.contents;
                        if (!frameText || frameText.toString().replace(/\s/g, '').length === 0) {
                            continue; // Skip empty frames
                        }
                        
                        // Detect lines in this text frame
                        var lines = getTextLines(textFrame);
                        
                        for (var l = 0; l < lines.length; l++) {
                            var lineHeight = (yMax - yMin) / Math.max(1, lines.length);
                            var lineY1 = yMin + (l * lineHeight);
                            var lineY2 = lineY1 + lineHeight;
                            
                            textBoxes.push({
                                text: lines[l],
                                points: [
                                    [xMin, lineY1],  // Top-left
                                    [xMax, lineY1],  // Top-right
                                    [xMax, lineY2],  // Bottom-right
                                    [xMin, lineY2]   // Bottom-left
                                ]
                            });
                        }
                    } catch (e) {
                        // Skip problematic frames
                    }
                }
            }
        }
        
        // Format data for Label.txt and Cache.cach for this page
        var ocrData = formatOCRData(jpgPathForLabels, textBoxes);
        
        // Write to Label.txt (newlines are now handled in the file initialization section)
        if (labelHasContent || pageIndex > 0) {
            labelFile.write(ocrData + "\n");
        } else {
            labelFile.write(ocrData + "\n");
            labelHasContent = true;
        }
        
        // Write to Cache.cach
        if (cacheHasContent || pageIndex > 0) {
            cacheFile.write(ocrData + "\n");
        } else {
            cacheFile.write(ocrData + "\n");
            cacheHasContent = true;
        }
        
        // Generate fileState.txt content - a line for each JPG
        var fileStateEntry = jpgPathForLabels + "\t1";
        
        // Write to fileState.txt
        if (fileStateHasContent || pageIndex > 0) {
            fileStateFile.write(fileStateEntry + "\n");
        } else {
            fileStateFile.write(fileStateEntry + "\n");
            fileStateHasContent = true;
        }
    }
    
    // Close all files
    labelFile.close();
    cacheFile.close();
    fileStateFile.close();
    
    // Build success message
    var successMsg = "Text extraction complete!\n\n" + 
                     "JPG and OCR training data saved to: " + ocrDataFolder.fsName + "\n" +
                     "Files updated: ";
    
    // Add list of JPGs created
    if (processedJpgs.length > 0) {
        successMsg += processedJpgs.join(", ") + ", ";
    }
    
    successMsg += "Label.txt, Cache.cach, fileState.txt\n\n" +
                  "Processed " + pageCount + " pages at " + exportResolution + " dpi\n" +
                  "Coordinates have been scaled to match the exported JPGs";
    
    alert(successMsg);
    
} catch (error) {
    alert("Error: " + error.message);
}

/**
 * Gets all text lines from a text frame
 */
function getTextLines(textFrame) {
    var lines = [];
    
    try {
        // First check if InDesign's native lines collection is available
        if (textFrame.lines && textFrame.lines.length > 0) {
            for (var i = 0; i < textFrame.lines.length; i++) {
                var lineText = textFrame.lines[i].contents.toString();
                // Trim the line text manually
                lineText = lineText.replace(/^\s+|\s+$/g, "");
                if (lineText !== "") {
                    lines.push(lineText);
                }
            }
            return lines;
        }
        
        // If not, split by paragraph breaks and estimate line breaking
        var frameText = textFrame.contents.toString();
        var paragraphs = frameText.split(/\r/);
        
        // Basic line detection for each paragraph
        for (var p = 0; p < paragraphs.length; p++) {
            var paraText = paragraphs[p].replace(/^\s+|\s+$/g, ""); // Manual trim
            if (paraText === "") continue;
            
            // Get text frame width and font information
            var frameWidth = textFrame.geometricBounds[3] - textFrame.geometricBounds[1];
            var fontSize = 12; // Default
            
            try {
                if (textFrame.paragraphs.length > p) {
                    fontSize = textFrame.paragraphs[p].pointSize;
                }
            } catch (e) {
                // Use default
            }
            
            // Estimate average character width based on font size
            var avgCharWidth = fontSize * 0.55; // Approximation
            
            // Estimate how many characters fit per line
            var frameWidthInPoints = frameWidth * 72;
            var charsPerLine = Math.floor(frameWidthInPoints / avgCharWidth);
            
            // If it's a short paragraph, keep it as one line
            if (paraText.length <= charsPerLine) {
                lines.push(paraText);
                continue;
            }
            
            // For longer paragraphs, break into words and reconstruct lines
            var words = paraText.split(/\s+/);
            var currentLine = words[0];
            var currentLength = words[0].length;
            
            for (var w = 1; w < words.length; w++) {
                var word = words[w];
                var wordLength = word.length + 1; // +1 for space
                
                if (currentLength + wordLength <= charsPerLine) {
                    // Add to current line
                    currentLine += " " + word;
                    currentLength += wordLength;
                } else {
                    // Start a new line
                    lines.push(currentLine);
                    currentLine = word;
                    currentLength = word.length;
                }
            }
            
            // Add the last line if needed
            if (currentLine !== "") {
                lines.push(currentLine);
            }
        }
    } catch (e) {
        // If all else fails, add the entire text as one line
        var fallbackText = textFrame.contents.toString().replace(/\r/g, " ");
        fallbackText = fallbackText.replace(/^\s+|\s+$/g, ""); // Manual trim
        if (fallbackText !== "") {
            lines.push(fallbackText);
        }
    }
    
    return lines;
}

/**
 * Formats OCR data in the specified format
 */
function formatOCRData(filename, textBoxes) {
    var jsonArray = [];
    
    for (var i = 0; i < textBoxes.length; i++) {
        var box = textBoxes[i];
        
        // Skip empty boxes
        if (!box.text || box.text.toString().replace(/\s/g, '') === "") continue;
        
        // Create the JSON object for this text box
        var jsonObj = {
            "transcription": box.text,
            "points": box.points, 
            "difficult": false,
            "key_cls": "None"
        };
        
        jsonArray.push(jsonObj);
    }
    
    // Format the output as filename + tab + JSON array
    return filename + "\t" + customStringify(jsonArray);
}

/**
 * Custom JSON stringify function since InDesign scripting doesn't have JSON
 */
function customStringify(obj) {
    if (obj === null) return "null";
    
    if (typeof obj === "string") {
        // Escape special characters in strings
        return '"' + obj.toString().replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\r/g, '\\r') + '"';
    }
    
    if (typeof obj === "number" || typeof obj === "boolean") {
        return obj.toString();
    }
    
    if (isArray(obj)) {
        var arrStr = "[";
        for (var i = 0; i < obj.length; i++) {
            arrStr += customStringify(obj[i]);
            if (i < obj.length - 1) {
                arrStr += ",";
            }
        }
        return arrStr + "]";
    }
    
    if (typeof obj === "object") {
        var objStr = "{";
        var keys = [];
        for (var key in obj) {
            if (obj.hasOwnProperty(key)) {
                keys.push(key);
            }
        }
        
        for (var i = 0; i < keys.length; i++) {
            var key = keys[i];
            objStr += '"' + key + '":' + customStringify(obj[key]);
            if (i < keys.length - 1) {
                objStr += ",";
            }
        }
        return objStr + "}";
    }
    
    // Default case
    return '""';
}

/**
 * Check if an object is an array
 */
function isArray(obj) {
    if (obj === null || typeof obj === "undefined") {
        return false;
    }
    
    return typeof obj === "object" && 
           typeof obj.length === "number" && 
           !(obj.propertyIsEnumerable("length"));
}