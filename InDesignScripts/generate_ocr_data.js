// InDesign Text Extraction for OCR Training with Font-Size Based Y-Scaling
// Method 1: Whole frame for single-line text frames (NO Y-OFFSET)
// Method 2: Line-by-line for multi-line text frames (WITH SCALED Y-OFFSET only for fonts > 10pt)
// ADDED: Multi-page support - saves each page as separate image with appropriate naming
// ADDED: Overwrite existing entries in Label.txt, Cache.cach, and fileState.txt

try {
    if (app.documents.length === 0) {
        throw new Error("No document is open. Please open an InDesign document first.");
    }
    
    // Debug info at start
    alert("Starting high-quality text extraction script...\nExport Resolution: 300 DPI with maximum quality settings\n\nUsing two different methods:\n- Method 1: Whole frame coordinates for single-line text (NO Y-OFFSET)\n- Method 2: Line-by-line coordinates for multi-line text (WITH SCALED Y-OFFSET for fonts > 10pt only)\n\nExporting each page as separate image and OVERWRITING any existing entries.");
    
    var doc = app.activeDocument;
    
    // Create output folder on desktop
    var desktopPath = Folder.desktop.fsName;
    var ocrDataFolder = new Folder(desktopPath + "/ocr_data");
    
    // Create the folder if it doesn't exist
    if (!ocrDataFolder.exists) {
        ocrDataFolder.create();
    }
    
    // Set up file references for Label.txt, Cache.cach, and fileState.txt
    var labelFile = new File(ocrDataFolder.fsName + "/Label.txt");
    var cacheFile = new File(ocrDataFolder.fsName + "/Cache.cach");
    var fileStateFile = new File(ocrDataFolder.fsName + "/fileState.txt");
    
    // Check if files exist
    var labelFileExists = labelFile.exists;
    var cacheFileExists = cacheFile.exists;
    var fileStateExists = fileStateFile.exists;
    
    // Read existing files into memory if they exist
    var labelData = [];
    var cacheData = [];
    var fileStateData = [];
    
    if (labelFileExists) {
        labelFile.encoding = "UTF-8";
        labelFile.open("r");
        var labelContent = labelFile.read();
        labelFile.close();
        
        if (labelContent) {
            labelData = labelContent.split("\n");
        }
    }
    
    if (cacheFileExists) {
        cacheFile.encoding = "UTF-8";
        cacheFile.open("r");
        var cacheContent = cacheFile.read();
        cacheFile.close();
        
        if (cacheContent) {
            cacheData = cacheContent.split("\n");
        }
    }
    
    if (fileStateExists) {
        fileStateFile.encoding = "UTF-8";
        fileStateFile.open("r");
        var fileStateContent = fileStateFile.read();
        fileStateFile.close();
        
        if (fileStateContent) {
            fileStateData = fileStateContent.split("\n");
        }
    }
    
    // Get document base name without extension
    var docBaseName = doc.name.replace(/\.indd$/i, "");
    
    // Get export resolution and calculate scaling factor
    var exportResolution = 300; // DPI - Higher resolution for better quality
    var scaleFactor = exportResolution / 72; // InDesign's native resolution is 72dpi
    
    // Base Y-coordinate adjustment - will be scaled based on font size
    var baseYOffset = 14.5; // Base points for 12pt font (will be scaled for other sizes)
    var standardFontSize = 12; // Reference font size for scaling
    
    // 0, 16
    // 13.5, 12
    
    // Create a hidden text field for string width measurement
    var measuringFrame = doc.pages[0].textFrames.add();
    measuringFrame.visible = false;
    
    // Get the total number of pages in the document
    var pageCount = doc.pages.length;
    
    // Track which page entries we've processed for cleaning up later
    var processedEntries = {};
    
    // Process each page in the document
    for (var pageIndex = 0; pageIndex < pageCount; pageIndex++) {
        // Get the current page
        var currentPage = doc.pages[pageIndex];
        
        // Create page-specific filename with page number suffix (1-based index for user friendliness)
        var pageNumber = pageIndex + 1;
        var pageJpgBaseName = docBaseName + "_page_" + pageNumber + ".jpg";
        var jpgPathOnDisk = ocrDataFolder.fsName + "/" + pageJpgBaseName;
        
        // For file references in Label.txt and fileState.txt, include the folder name
        var jpgPathForLabels = "ocr_data/" + pageJpgBaseName;
        
        // Flag to track if we need to overwrite an existing entry
        var entryExists = false;
        
        // Index of existing entries in each file
        var labelIndex = -1;
        var cacheIndex = -1;
        var fileStateIndex = -1;
        
        // Check if this file already exists in our data arrays
        for (var i = 0; i < labelData.length; i++) {
            if (labelData[i].indexOf(jpgPathForLabels + "\t") === 0) {
                labelIndex = i;
                entryExists = true;
                break;
            }
        }
        
        for (var i = 0; i < cacheData.length; i++) {
            if (cacheData[i].indexOf(jpgPathForLabels + "\t") === 0) {
                cacheIndex = i;
                entryExists = true;
                break;
            }
        }
        
        for (var i = 0; i < fileStateData.length; i++) {
            if (fileStateData[i].indexOf(jpgPathForLabels + "\t") === 0) {
                fileStateIndex = i;
                entryExists = true;
                break;
            }
        }
        
        // Track this entry as processed
        processedEntries[jpgPathForLabels] = true;
        
        // Set up export preferences for JPG with enhanced quality settings
        app.jpegExportPreferences.jpegQuality = JPEGOptionsQuality.MAXIMUM;
        app.jpegExportPreferences.exportResolution = exportResolution;
        app.jpegExportPreferences.jpegColorSpace = JpegColorSpaceEnum.RGB;
        app.jpegExportPreferences.antiAlias = true;
        app.jpegExportPreferences.useDocumentBleeds = true;
        app.jpegExportPreferences.simulateOverprint = true;
        
        // Choose only the current page for export
        app.jpegExportPreferences.jpegExportRange = ExportRangeOrAllPages.EXPORT_RANGE;
        app.jpegExportPreferences.pageString = pageNumber.toString();
        
        // Export current page as JPG
        try {
            doc.exportFile(ExportFormat.JPG, new File(jpgPathOnDisk), false);
        } catch (e) {
            alert("Error exporting JPG for page " + pageNumber + ": " + e.message + 
                  "\nPlease manually export this page as JPG to: " + jpgPathOnDisk);
        }
        
        // Store text boxes with their coordinates for this page
        var textBoxes = [];
        
        // Extract text from text frames on the current page
        for (var i = 0; i < doc.stories.length; i++) {
            var story = doc.stories[i];
            var storyContent = story.contents;
            
            // Check if story has content
            if (storyContent && storyContent.toString().replace(/\s/g, '').length > 0) {
                // Process each text frame in this story
                for (var j = 0; j < story.textContainers.length; j++) {
                    var textFrame = story.textContainers[j];
                    
                    try {
                        // Check if this frame is on the current page (not on pasteboard or other pages)
                        var parentPage = null;
                        try {
                            parentPage = textFrame.parentPage;
                            // Skip if not on a page or not on the current page
                            if (!parentPage || parentPage !== currentPage) continue;
                        } catch (e) {
                            continue; // Skip frames not on a page
                        }
                        
                        // Get frame properties
                        var frameBounds = textFrame.geometricBounds;
                        var frameY1 = frameBounds[0] * 72; // top
                        var frameX1 = frameBounds[1] * 72; // left
                        var frameY2 = frameBounds[2] * 72; // bottom
                        var frameX2 = frameBounds[3] * 72; // right
                        var frameWidth = frameX2 - frameX1;
                        var frameHeight = frameY2 - frameY1;
                        
                        // Get text alignment for this frame
                        var textAlignment = Justification.LEFT_ALIGN; // Default
                        var verticalAlignment = VerticalJustification.TOP_ALIGN; // Default
                        
                        try {
                            if (textFrame.paragraphs.length > 0) {
                                textAlignment = textFrame.paragraphs[0].justification;
                            }
                            
                            // Get vertical alignment
                            verticalAlignment = textFrame.textFramePreferences.verticalJustification;
                        } catch (e) {
                            // Use defaults
                        }
                        
                        // Get text inset values (margins inside the text frame)
                        var topInset = 0;
                        var leftInset = 0;
                        var rightInset = 0;
                        var bottomInset = 0;
                        
                        try {
                            topInset = textFrame.textFramePreferences.insetSpacing[0] * 72;
                            leftInset = textFrame.textFramePreferences.insetSpacing[1] * 72;
                            bottomInset = textFrame.textFramePreferences.insetSpacing[2] * 72;
                            rightInset = textFrame.textFramePreferences.insetSpacing[3] * 72;
                        } catch (e) {
                            // Use defaults (0)
                        }
                        
                        // Adjust frame bounds with insets
                        frameY1 += topInset;
                        frameX1 += leftInset;
                        frameY2 -= bottomInset;
                        frameX2 -= rightInset;
                        frameWidth = frameX2 - frameX1;
                        frameHeight = frameY2 - frameY1;
                        
                        // Get frame text content
                        var frameText = textFrame.contents.toString().replace(/^\s+|\s+$/g, "");
                        if (frameText === "") continue;
                        
                        // Check if this text frame has multiple lines
                        var hasMultipleLines = false;
                        var lineCount = 0;
                        
                        try {
                            // Try to get lines collection
                            if (textFrame.lines && textFrame.lines.length > 0) {
                                lineCount = textFrame.lines.length;
                                hasMultipleLines = lineCount > 1;
                            }
                        } catch (e) {
                            // Fallback check - look for line breaks in the text
                            hasMultipleLines = frameText.indexOf("\r") >= 0;
                        }
                        
                        // DUAL METHODS APPROACH:
                        
                        // METHOD 1: For single-line text frames, use the exact string width instead of frame width
                        if (!hasMultipleLines) {
                            var textWidth = getExactTextWidth(textFrame, frameText);
                            
                            // Determine the start X position based on text alignment
                            var startX = frameX1;
                            
                            if (textAlignment === Justification.RIGHT_ALIGN || textAlignment === Justification.RIGHT_JUSTIFIED) {
                                startX = frameX2 - textWidth;
                            } else if (textAlignment === Justification.CENTER_ALIGN || textAlignment === Justification.CENTER_JUSTIFIED) {
                                startX = frameX1 + (frameWidth - textWidth) / 2;
                            }
                            
                            // Scale WITHOUT applying Y-offset for single-line text
                            var yMin = Math.round(frameY1 * scaleFactor);
                            var xMin = Math.round(startX * scaleFactor);
                            var yMax = Math.round(frameY2 * scaleFactor);
                            var xMax = Math.round((startX + textWidth) * scaleFactor);
                            
                            // Add the text with accurate width
                            textBoxes.push({
                                text: frameText,
                                points: [
                                    [xMin, yMin],  // Top-left
                                    [xMax, yMin],  // Top-right
                                    [xMax, yMax],  // Bottom-right
                                    [xMin, yMax]   // Bottom-left
                                ]
                            });
                        }
                        // METHOD 2: For multi-line text frames, process each line separately WITH SCALED Y-OFFSET
                        else if (textFrame.lines && textFrame.lines.length > 0) {
                            // CRITICAL: Handle multiline text frames with proper spacing
                            
                            // First, collect all lines in the frame with their metrics
                            var frameLines = [];
                            var totalHeight = 0;
                            var maxFontSize = 0;
                            
                            for (var l = 0; l < textFrame.lines.length; l++) {
                                var line = textFrame.lines[l];
                                var lineText = line.contents.toString().replace(/^\s+|\s+$/g, "");
                                
                                if (lineText === "") continue;
                                
                                // Get font metrics for the line
                                var fontSize = 12; // Default font size
                                var leading = 0;   // Space between lines
                                
                                try {
                                    // Get font size from first character in line
                                    fontSize = line.characters[0].pointSize;
                                    
                                    // Get leading (line spacing)
                                    leading = line.leading;
                                    if (leading === Leading.AUTO) {
                                        leading = fontSize * 1.2; // Approximate auto leading
                                    }
                                } catch (e) {
                                    // Use defaults
                                    fontSize = 12;
                                    leading = fontSize * 1.2;
                                }
                                
                                if (fontSize > maxFontSize) {
                                    maxFontSize = fontSize;
                                }
                                
                                // Get exact text width for this line using an accurate measurement
                                var lineWidth = getExactTextWidth(line, lineText);
                                
                                // Store all line information
                                frameLines.push({
                                    text: lineText,
                                    fontSize: fontSize,
                                    leading: leading,
                                    width: lineWidth,
                                    height: fontSize, // Exact font size for height
                                    index: l
                                });
                                
                                // Keep track of total height for vertical positioning
                                totalHeight += (l > 0) ? leading : fontSize;
                            }
                            
                            // Now position the lines based on vertical alignment
                            var currentY = 0;
                            
                            if (verticalAlignment === VerticalJustification.BOTTOM_ALIGN) {
                                // For bottom alignment, start from the bottom of the frame
                                currentY = frameY2 - frameLines[frameLines.length - 1].fontSize;
                                
                                // Position lines from bottom to top with proper spacing
                                for (var l = frameLines.length - 1; l >= 0; l--) {
                                    var line = frameLines[l];
                                    var lineHeight = line.height;
                                    
                                    // Calculate horizontal position based on text alignment
                                    var lineX1 = frameX1;
                                    var lineX2 = lineX1 + line.width;
                                    
                                    switch (textAlignment) {
                                        case Justification.RIGHT_ALIGN:
                                        case Justification.RIGHT_JUSTIFIED:
                                            lineX1 = frameX2 - line.width;
                                            lineX2 = frameX2;
                                            break;
                                            
                                        case Justification.CENTER_ALIGN:
                                        case Justification.CENTER_JUSTIFIED:
                                            var centerOffset = (frameWidth - line.width) / 2;
                                            lineX1 = frameX1 + centerOffset;
                                            lineX2 = lineX1 + line.width;
                                            break;
                                            
                                        case Justification.FULLY_JUSTIFIED:
                                            if (l < frameLines.length - 1) {
                                                lineX1 = frameX1;
                                                lineX2 = frameX2;
                                            }
                                            break;
                                    }
                                    
                                    // Calculate vertical position for this line
                                    var lineY2 = currentY;
                                    var lineY1 = lineY2 - line.fontSize; // Use exact font size
                                    
                                    // Move up for the next line (if any)
                                    if (l > 0) {
                                        currentY = lineY1 - (frameLines[l-1].leading - frameLines[l-1].fontSize);
                                    }
                                    
                                    // Only apply Y-offset if font size is greater than 10
                                    var scaledYOffset = 0;
                                    if (Math.floor(line.fontSize) >= 8) {
                                        var fontScalingFactor = line.fontSize / standardFontSize;
                                        scaledYOffset = baseYOffset * fontScalingFactor;
                                    }
                                    
                                    // Apply scaling factor for export resolution and add SCALED Y-offset for multiline text
                                    var scaledLineX1 = Math.round(lineX1 * scaleFactor);
                                    var scaledLineY1 = Math.round((lineY1 + scaledYOffset) * scaleFactor);
                                    var scaledLineX2 = Math.round(lineX2 * scaleFactor);
                                    var scaledLineY2 = Math.round((lineY2 + scaledYOffset) * scaleFactor);
                                    
                                    // Add the line with a sequential Y position from the bottom
                                    textBoxes.push({
                                        text: line.text,
                                        points: [
                                            [scaledLineX1, scaledLineY1],  // Top-left
                                            [scaledLineX2, scaledLineY1],  // Top-right
                                            [scaledLineX2, scaledLineY2],  // Bottom-right
                                            [scaledLineX1, scaledLineY2]   // Bottom-left
                                        ]
                                    });
                                }
                            } else if (verticalAlignment === VerticalJustification.CENTER_ALIGN) {
                                // For center alignment, center all the text in the frame
                                var startY = frameY1 + (frameHeight - totalHeight) / 2;
                                currentY = startY;
                                
                                for (var l = 0; l < frameLines.length; l++) {
                                    var line = frameLines[l];
                                    
                                    // Calculate horizontal position based on text alignment
                                    var lineX1 = frameX1;
                                    var lineX2 = lineX1 + line.width;
                                    
                                    switch (textAlignment) {
                                        case Justification.RIGHT_ALIGN:
                                        case Justification.RIGHT_JUSTIFIED:
                                            lineX1 = frameX2 - line.width;
                                            lineX2 = frameX2;
                                            break;
                                            
                                        case Justification.CENTER_ALIGN:
                                        case Justification.CENTER_JUSTIFIED:
                                            var centerOffset = (frameWidth - line.width) / 2;
                                            lineX1 = frameX1 + centerOffset;
                                            lineX2 = lineX1 + line.width;
                                            break;
                                            
                                        case Justification.FULLY_JUSTIFIED:
                                            if (l < frameLines.length - 1) {
                                                lineX1 = frameX1;
                                                lineX2 = frameX2;
                                            }
                                            break;
                                    }
                                    
                                    // Calculate vertical position for this line
                                    var lineY1 = currentY;
                                    var lineY2 = lineY1 + line.fontSize; // Use exact font size
                                    
                                    // Move down for the next line - use exact leading value
                                    currentY = lineY1 + line.leading;
                                    
                                    // Only apply Y-offset if font size is greater than 10
                                    var scaledYOffset = 0;
                                    if (Math.floor(line.fontSize) >= 8) {
                                        var fontScalingFactor = line.fontSize / standardFontSize;
                                        scaledYOffset = baseYOffset * fontScalingFactor;
                                    }
                                    
                                    // Apply scaling factor for export resolution and add SCALED Y-offset for multiline text
                                    var scaledLineX1 = Math.round(lineX1 * scaleFactor);
                                    var scaledLineY1 = Math.round((lineY1 + scaledYOffset) * scaleFactor);
                                    var scaledLineX2 = Math.round(lineX2 * scaleFactor);
                                    var scaledLineY2 = Math.round((lineY2 + scaledYOffset) * scaleFactor);
                                    
                                    // Add the line
                                    textBoxes.push({
                                        text: line.text,
                                        points: [
                                            [scaledLineX1, scaledLineY1],  // Top-left
                                            [scaledLineX2, scaledLineY1],  // Top-right
                                            [scaledLineX2, scaledLineY2],  // Bottom-right
                                            [scaledLineX1, scaledLineY2]   // Bottom-left
                                        ]
                                    });
                                }
                            } else {
                                // For top alignment (default), start from the top of the frame
                                currentY = frameY1;
                                
                                for (var l = 0; l < frameLines.length; l++) {
                                    var line = frameLines[l];
                                    
                                    // Calculate horizontal position based on text alignment
                                    var lineX1 = frameX1;
                                    var lineX2 = lineX1 + line.width;
                                    
                                    switch (textAlignment) {
                                        case Justification.RIGHT_ALIGN:
                                        case Justification.RIGHT_JUSTIFIED:
                                            lineX1 = frameX2 - line.width;
                                            lineX2 = frameX2;
                                            break;
                                            
                                        case Justification.CENTER_ALIGN:
                                        case Justification.CENTER_JUSTIFIED:
                                            var centerOffset = (frameWidth - line.width) / 2;
                                            lineX1 = frameX1 + centerOffset;
                                            lineX2 = lineX1 + line.width;
                                            break;
                                            
                                        case Justification.FULLY_JUSTIFIED:
                                            if (l < frameLines.length - 1) {
                                                lineX1 = frameX1;
                                                lineX2 = frameX2;
                                            }
                                            break;
                                    }
                                    
                                    // Calculate vertical position for this line
                                    var lineY1 = currentY;
                                    var lineY2 = lineY1 + line.fontSize; // Use exact font size
                                    
                                    // Move down for the next line - use exact leading value
                                    currentY = lineY1 + line.leading;
                                    
                                    // Only apply Y-offset if font size is greater than 10
                                    var scaledYOffset = 0;
                                    if (Math.floor(line.fontSize) >= 8) {
                                        var fontScalingFactor = line.fontSize / standardFontSize;
                                        scaledYOffset = baseYOffset * fontScalingFactor;
                                    }
                                    
                                    // Apply scaling factor for export resolution and add SCALED Y-offset for multiline text
                                    var scaledLineX1 = Math.round(lineX1 * scaleFactor);
                                    var scaledLineY1 = Math.round((lineY1 + scaledYOffset) * scaleFactor);
                                    var scaledLineX2 = Math.round(lineX2 * scaleFactor);
                                    var scaledLineY2 = Math.round((lineY2 + scaledYOffset) * scaleFactor);
                                    
                                    // Add the line
                                    textBoxes.push({
                                        text: line.text,
                                        points: [
                                            [scaledLineX1, scaledLineY1],  // Top-left
                                            [scaledLineX2, scaledLineY1],  // Top-right
                                            [scaledLineX2, scaledLineY2],  // Bottom-right
                                            [scaledLineX1, scaledLineY2]   // Bottom-left
                                        ]
                                    });
                                }
                            }
                        } else {
                            // Fallback for when lines collection is not available but we have multiple lines
                            // Get lines using our text parsing function
                            var lines = getTextLines(textFrame);
                            
                            if (lines.length > 1) {
                                // Multiple lines detected, process each separately WITH SCALED Y-OFFSET
                                var avgFontSize = 12; // Default
                                try {
                                    if (textFrame.paragraphs.length > 0) {
                                        avgFontSize = textFrame.paragraphs[0].pointSize;
                                    }
                                } catch (e) {
                                    // Use default
                                }
                                
                                var avgLineHeight = avgFontSize * 1.2; // Approximate line height
                                var totalHeight = avgLineHeight * lines.length;
                                
                                // Determine Y position based on vertical alignment
                                var startY = frameY1; // Default (top)
                                
                                if (verticalAlignment === VerticalJustification.BOTTOM_ALIGN) {
                                    startY = frameY2 - totalHeight;
                                } else if (verticalAlignment === VerticalJustification.CENTER_ALIGN) {
                                    startY = frameY1 + (frameHeight - totalHeight) / 2;
                                }
                                
                                // Only apply Y-offset if font size is greater than 10
                                var scaledYOffset = 0;
                                if (Math.floor(avgFontSize) >= 8) {
                                    var fontScalingFactor = avgFontSize / standardFontSize;
                                    scaledYOffset = baseYOffset * fontScalingFactor;
                                }
                                
                                // Process each line
                                for (var l = 0; l < lines.length; l++) {
                                    var lineText = lines[l];
                                    
                                    // Measure the exact width of this line text
                                    // Create measurements for this specific line
                                    measuringFrame.contents = lineText;
                                    measuringFrame.paragraphs[0].pointSize = avgFontSize;
                                    
                                    // Get accurate text width
                                    var lineWidth = 0;
                                    try {
                                        // Use our helper to get exact width
                                        lineWidth = getExactTextWidth(measuringFrame, lineText);
                                    } catch (e) {
                                        // Fallback to estimate
                                        lineWidth = lineText.length * avgFontSize * 0.6;
                                    }
                                    
                                    // Calculate horizontal position based on alignment
                                    var lineX1 = frameX1;
                                    var lineX2 = lineX1 + lineWidth;
                                    
                                    // Adjust based on alignment
                                    if (textAlignment) {
                                        switch (textAlignment) {
                                            case Justification.RIGHT_ALIGN:
                                            case Justification.RIGHT_JUSTIFIED:
                                                lineX1 = frameX2 - lineWidth;
                                                lineX2 = frameX2;
                                                break;
                                                
                                            case Justification.CENTER_ALIGN:
                                            case Justification.CENTER_JUSTIFIED:
                                                var centerOffset = (frameWidth - lineWidth) / 2;
                                                lineX1 = frameX1 + centerOffset;
                                                lineX2 = lineX1 + lineWidth;
                                                break;
                                                
                                            case Justification.FULLY_JUSTIFIED:
                                                if (l < lines.length - 1) {
                                                    lineX1 = frameX1;
                                                    lineX2 = frameX2;
                                                }
                                                break;
                                        }
                                    }
                                    
                                    // Calculate vertical position
                                    var lineY1 = startY + (l * avgLineHeight);
                                    var lineY2 = lineY1 + avgFontSize; // Exact font size
                                    
                                    // Apply scaling factor and add SCALED Y-offset for multiline text with font > 10pt
                                    var scaledLineX1 = Math.round(lineX1 * scaleFactor);
                                    var scaledLineY1 = Math.round((lineY1 + scaledYOffset) * scaleFactor);
                                    var scaledLineX2 = Math.round(lineX2 * scaleFactor);
                                    var scaledLineY2 = Math.round((lineY2 + scaledYOffset) * scaleFactor);
                                    
                                    // Add the line as a separate text box
                                    textBoxes.push({
                                        text: lineText,
                                        points: [
                                            [scaledLineX1, scaledLineY1],  // Top-left
                                            [scaledLineX2, scaledLineY1],  // Top-right
                                            [scaledLineX2, scaledLineY2],  // Bottom-right
                                            [scaledLineX1, scaledLineY2]   // Bottom-left
                                        ]
                                    });
                                }
                            } else {
                                // Single line fallback - use accurate measurement
                                // Measure the exact width of this text
                                var exactWidth = getExactTextWidth(textFrame, frameText);
                                var startX = frameX1;
                                
                                // Adjust X position based on alignment
                                if (textAlignment === Justification.RIGHT_ALIGN || textAlignment === Justification.RIGHT_JUSTIFIED) {
                                    startX = frameX2 - exactWidth;
                                } else if (textAlignment === Justification.CENTER_ALIGN || textAlignment === Justification.CENTER_JUSTIFIED) {
                                    startX = frameX1 + (frameWidth - exactWidth) / 2;
                                }
                                
                                var yMin = Math.round(frameY1 * scaleFactor); // No Y-offset for single-line text
                                var xMin = Math.round(startX * scaleFactor);
                                var yMax = Math.round(frameY2 * scaleFactor); // No Y-offset for single-line text
                                var xMax = Math.round((startX + exactWidth) * scaleFactor);
                                
                                textBoxes.push({
                                    text: frameText,
                                    points: [
                                        [xMin, yMin],  // Top-left
                                        [xMax, yMin],  // Top-right
                                        [xMax, yMax],  // Bottom-right
                                        [xMin, yMax]   // Bottom-left
                                    ]
                                });
                            }
                        }
                    } catch (e) {
                        // If all approaches fail, add the whole text frame as a fallback
                        try {
                            var frameText = textFrame.contents.toString().replace(/^\s+|\s+$/g, "");
                            if (frameText !== "") {
                                // Check if this is a multi-line text (to decide on Y-offset)
                                var hasLineBreaks = frameText.indexOf("\r") >= 0;
                                
                                // Only apply Y-offset for multi-line text
                                var fallbackYOffset = 0;
                                
                                // Get estimated font size
                                var estFontSize = 12; // Default
                                
                                try {
                                    if (textFrame.paragraphs.length > 0) {
                                        estFontSize = textFrame.paragraphs[0].pointSize;
                                    }
                                } catch (e) {
                                    // Use default
                                }
                                
                                // Apply Y-offset only if multi-line and font size > 10
                                if (hasLineBreaks && Math.floor(estFontSize) >= 8) {
                                    fallbackYOffset = baseYOffset * (estFontSize / standardFontSize);
                                }
                                
                                // For fallback, try to at least get accurate text width
                                var fallbackWidth = frameWidth;
                                try {
                                    if (!hasLineBreaks) {
                                        // Only measure width for single line text
                                        fallbackWidth = getExactTextWidth(textFrame, frameText);
                                    }
                                } catch (e) {
                                    // Use frame width as fallback
                                }
                                
                                // Calculate X position based on alignment
                                var fallbackX1 = frameX1;
                                var fallbackX2 = fallbackX1 + fallbackWidth;
                                
                                if (!hasLineBreaks) {
                                    if (textAlignment === Justification.RIGHT_ALIGN || textAlignment === Justification.RIGHT_JUSTIFIED) {
                                        fallbackX1 = frameX2 - fallbackWidth;
                                        fallbackX2 = frameX2;
                                    } else if (textAlignment === Justification.CENTER_ALIGN || textAlignment === Justification.CENTER_JUSTIFIED) {
                                        fallbackX1 = frameX1 + (frameWidth - fallbackWidth) / 2;
                                        fallbackX2 = fallbackX1 + fallbackWidth;
                                    }
                                }
                                
                                // Convert to points and apply scaling with Y-offset only for multi-line text with font size > 10
                                var yMin = Math.round((frameBounds[0] * 72 + fallbackYOffset) * scaleFactor);
                                var xMin = Math.round(fallbackX1 * scaleFactor);
                                var yMax = Math.round((frameBounds[2] * 72 + fallbackYOffset) * scaleFactor);
                                var xMax = Math.round(fallbackX2 * scaleFactor);

                                // Add the entire textframe as a fallback
                                textBoxes.push({
                                    text: frameText,
                                    points: [
                                        [xMin, yMin],  // Top-left
                                        [xMax, yMin],  // Top-right
                                        [xMax, yMax],  // Bottom-right
                                        [xMin, yMax]   // Bottom-left
                                    ]
                                });
                            }
                        } catch (e) {
                            // Skip problematic frames
                        }
                    }
                }
            }
        }
        
        // Format data for this page and append to Label.txt and Cache.cach
        var ocrData = formatOCRData(jpgPathForLabels, textBoxes);
        
        // If we found an existing entry, overwrite it at its original position
        if (labelIndex !== -1) {
            labelData[labelIndex] = ocrData;
        } else {
            // Otherwise append
            labelData.push(ocrData);
        }
        
        if (cacheIndex !== -1) {
            cacheData[cacheIndex] = ocrData;
        } else {
            cacheData.push(ocrData);
        }
        
        // Generate fileState.txt entry for this page - one line per page
        var fileStateContent = jpgPathForLabels + "\t1";
        
        if (fileStateIndex !== -1) {
            fileStateData[fileStateIndex] = fileStateContent;
        } else {
            fileStateData.push(fileStateContent);
        }
    }
    
    // Remove measuring frame when done
    if (measuringFrame && measuringFrame.isValid) {
        measuringFrame.remove();
    }
    
    // Write the updated data arrays back to the files
    labelFile.encoding = "UTF-8";
    cacheFile.encoding = "UTF-8";
    fileStateFile.encoding = "UTF-8";
    
    labelFile.open("w");
    cacheFile.open("w");
    fileStateFile.open("w");
    
    // Write the updated data
    labelFile.write(labelData.join("\n"));
    cacheFile.write(cacheData.join("\n"));
    fileStateFile.write(fileStateData.join("\n"));
    
    // Close all files
    labelFile.close();
    cacheFile.close();
    fileStateFile.close();
    
    alert("Text extraction complete!\n\n" + 
          "High-quality JPG and OCR training data saved to: " + ocrDataFolder.fsName + "\n" +
          "Exported " + pageCount + " pages with naming pattern: " + docBaseName + "_page_X.jpg\n" +
          "Image quality: " + exportResolution + " DPI with maximum quality settings\n" + 
          "Created/Updated files: Label.txt, Cache.cach, fileState.txt\n\n" +
          "Using two different methods:\n" +
          "- Single-line text: using entire text frame coordinates (NO Y-OFFSET)\n" +
          "- Multi-line text: processing each line separately (WITH FONT-SCALED Y-OFFSET for fonts > 10pt only)\n" +
          "Base Y-offset: " + baseYOffset + " points (scaled based on font size)\n\n" +
          "OVERWRITE MODE: Any existing entries for the same JPG files were overwritten.");
    
} catch (error) {
    alert("Error: " + error.message);
}

/**
 * Get the exact width of a text string
 * This function calculates the actual width of text rather than using the frame width
 */
function getExactTextWidth(textObj, text) {
    var width = 0;
    
    try {
        // Method 1: Get width by character-by-character measurement
        if (textObj.characters && textObj.characters.length > 0) {
            // First try to get actual bounds of the text
            width = 0;
            var fontInfo = {};
            
            // Get font settings from first character for baseline
            var basePointSize = textObj.characters[0].pointSize;
            var baseFont = textObj.characters[0].appliedFont;
            
            // Iterate through each character to calculate accurate width
            for (var i = 0; i < text.length; i++) {
                var charWidth = basePointSize * 0.6; // Default approximate width
                
                try {
                    // Get actual character
                    var currentChar = text.charAt(i);
                    
                    // Try to find this character in the text object to get its actual metrics
                    for (var j = 0; j < textObj.characters.length; j++) {
                        if (textObj.characters[j].contents === currentChar) {
                            var character = textObj.characters[j];
                            
                            // Calculate width based on font and scaling
                            charWidth = character.pointSize * 0.6; // Base width
                            
                            // Apply horizontal scaling
                            if (character.horizontalScale) {
                                charWidth *= character.horizontalScale / 100;
                            }
                            
                            // Apply tracking (kerning)
                            if (character.tracking) {
                                charWidth += (character.pointSize * character.tracking / 1000);
                            }
                            
                            break;
                        }
                    }
                } catch (e) {
                    // Fallback to approximation
                }
                
                width += charWidth;
            }
            
            // Add a small buffer for accuracy (5%)
            width *= 1.05;
        } 
        // Method 2: Use the text frame's native width if it's a tight-fitting frame
        else if (textObj.geometricBounds) {
            var bounds = textObj.geometricBounds;
            var frameWidth = (bounds[3] - bounds[1]) * 72;
            
            // Check if frame is approximately the right size
            if (text.length * 10 <= frameWidth && frameWidth <= text.length * 25) { 
                // Frame width seems reasonable for the text
                width = frameWidth;
            } else {
                // Otherwise estimate based on character count and font size
                var estFontSize = 12;
                try {
                    if (textObj.paragraphs && textObj.paragraphs.length > 0) {
                        estFontSize = textObj.paragraphs[0].pointSize;
                    }
                } catch (e) {
                    // Use default size
                }
                width = text.length * estFontSize * 0.6;
            }
        } else {
            // Fallback estimation
            var estFontSize = 12;
            try {
                if (textObj.paragraphs && textObj.paragraphs.length > 0) {
                    estFontSize = textObj.paragraphs[0].pointSize;
                }
            } catch (e) {
                // Use default size
            }
            width = text.length * estFontSize * 0.6;
        }
    } catch (e) {
        // Ultimate fallback - estimate based on character count
        width = text.length * 7.2; // 12pt * 0.6 scaling factor
    }
    
    return width;
}

/**
 * Calculate the width of a text line based on character metrics
 */
function getLineWidth(line) {
    var lineWidth = 0;
    
    try {
        // If horizontal scaling or tracking is applied, this affects width
        for (var i = 0; i < line.characters.length; i++) {
            var character = line.characters[i];
            var charWidth = character.pointSize * 0.6; // Approximate average character width
            
            // Apply horizontal scaling if present
            if (character.horizontalScale) {
                charWidth *= character.horizontalScale / 100;
            }
            
            // Apply tracking if present (tracking is in 1/1000 em units)
            if (character.tracking) {
                charWidth += (character.pointSize * character.tracking / 1000);
            }
            
            lineWidth += charWidth;
        }
        
        // Add a small buffer for accuracy (5%)
        lineWidth *= 1.05;
    } catch (e) {
        // If character-by-character calculation fails, use an approximation
        lineWidth = line.length * line.characters[0].pointSize * 0.6;
    }
    
    return lineWidth;
}

/**
 * Gets all text lines from a text frame when the lines collection is not available
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