// InDesign Text Extraction for OCR Training with Font-Size Based Y-Scaling
// Method 1: Whole frame for single-line text frames (NO Y-OFFSET)
// Method 2: Line-by-line for multi-line text frames (WITH SCALED Y-OFFSET)

try {
    if (app.documents.length === 0) {
        throw new Error("No document is open. Please open an InDesign document first.");
    }
    
    // Debug info at start
    alert("Starting text extraction script...\nUsing two different methods:\n- Method 1: Whole frame coordinates for single-line text (NO Y-OFFSET)\n- Method 2: Line-by-line coordinates for multi-line text (WITH SCALED Y-OFFSET)");
    
    var doc = app.activeDocument;
    
    // Create output folder on desktop
    var desktopPath = Folder.desktop.fsName;
    var ocrDataFolder = new Folder(desktopPath + "/ocr_data");
    
    // Create the folder if it doesn't exist
    if (!ocrDataFolder.exists) {
        ocrDataFolder.create();
    }
    
    // Set up JPG export with same base name as the document
    var jpgBaseName = doc.name.replace(/\.indd$/i, "") + ".jpg";
    var jpgPathOnDisk = ocrDataFolder.fsName + "/" + jpgBaseName;
    
    // For file references in Label.txt and fileState.txt, include the folder name
    var jpgPathForLabels = "ocr_data/" + jpgBaseName;
    
    // Get document dimensions 
    var docWidth = doc.documentPreferences.pageWidth * 72; // Convert to points
    var docHeight = doc.documentPreferences.pageHeight * 72; // Convert to points
    
    // Apply scaling factor for export resolution
    var exportResolution = 150; // DPI
    
    // Calculate scaling factor based on resolution
    // InDesign's native resolution is 72dpi, so the scaling factor is exportResolution/72
    var scaleFactor = exportResolution / 72;
    
    // Base Y-coordinate adjustment - will be scaled based on font size
    var baseYOffset = 13.5; // Base points for 12pt font (will be scaled for other sizes)
    var standardFontSize = 12; // Reference font size for scaling
    
    // Export as JPG
    try {
        // Set up basic export preferences
        app.jpegExportPreferences.jpegQuality = JPEGOptionsQuality.MAXIMUM;
        app.jpegExportPreferences.exportResolution = exportResolution;
        app.jpegExportPreferences.jpegExportRange = ExportRangeOrAllPages.EXPORT_ALL;
        
        // Export as JPG
        doc.exportFile(ExportFormat.JPG, new File(jpgPathOnDisk), false);
    } catch (e) {
        alert("Error exporting JPG: " + e.message + 
              "\nPlease manually export your document as JPG to: " + jpgPathOnDisk);
    }
    
    // Create output files - checking if they exist first
    var labelFile = new File(ocrDataFolder.fsName + "/Label.txt");
    var cacheFile = new File(ocrDataFolder.fsName + "/Cache.cach");
    var fileStateFile = new File(ocrDataFolder.fsName + "/fileState.txt");
    
    // Check if files exist to determine if we should append
    var labelFileExists = labelFile.exists;
    var cacheFileExists = cacheFile.exists;
    var fileStateExists = fileStateFile.exists;
    
    // Open files for appending if they exist, or writing if new
    labelFile.encoding = "UTF-8";
    cacheFile.encoding = "UTF-8";
    fileStateFile.encoding = "UTF-8";
    
    if (labelFileExists) {
        labelFile.open("a");
    } else {
        labelFile.open("w");
    }
    
    if (cacheFileExists) {
        cacheFile.open("a");
    } else {
        cacheFile.open("w");
    }
    
    if (fileStateExists) {
        fileStateFile.open("a");
    } else {
        fileStateFile.open("w");
    }
    
    // Store text boxes with their coordinates
    var textBoxes = [];
    
    // Extract text from text frames in the document
    for (var i = 0; i < doc.stories.length; i++) {
        var story = doc.stories[i];
        var storyContent = story.contents;
        
        // Check if story has content
        if (storyContent && storyContent.toString().replace(/\s/g, '').length > 0) {
            // Process each text frame in this story
            for (var j = 0; j < story.textContainers.length; j++) {
                var textFrame = story.textContainers[j];
                
                try {
                    // Check if this frame is on a page (not on pasteboard)
                    var parentPage = null;
                    try {
                        parentPage = textFrame.parentPage;
                        if (!parentPage) continue; // Skip frames not on a page
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
                    
                    // METHOD 1: For single-line text frames, use the entire frame coordinates WITH NO Y-OFFSET
                    if (!hasMultipleLines) {
                        // Scale WITHOUT applying Y-offset
                        var yMin = Math.round(frameY1 * scaleFactor); // No Y-offset for single-line text
                        var xMin = Math.round(frameX1 * scaleFactor);
                        var yMax = Math.round(frameY2 * scaleFactor); // No Y-offset for single-line text
                        var xMax = Math.round(frameX2 * scaleFactor);
                        
                        // Add the entire frame as one text box
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
                            
                            // Calculate line width
                            var lineWidth = 0;
                            try {
                                if (line.length > 0) {
                                    lineWidth = getLineWidth(line);
                                } else {
                                    lineWidth = lineText.length * fontSize * 0.6;
                                }
                            } catch (e) {
                                lineWidth = lineText.length * fontSize * 0.6;
                            }
                            
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
                                
                                // Calculate scaling factor for Y-offset based on font size
                                var fontScalingFactor = line.fontSize / standardFontSize;
                                var scaledYOffset = baseYOffset * fontScalingFactor;
                                
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
                                
                                // Calculate scaling factor for Y-offset based on font size
                                var fontScalingFactor = line.fontSize / standardFontSize;
                                var scaledYOffset = baseYOffset * fontScalingFactor;
                                
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
                                
                                // Calculate scaling factor for Y-offset based on font size
                                var fontScalingFactor = line.fontSize / standardFontSize;
                                var scaledYOffset = baseYOffset * fontScalingFactor;
                                
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
                            
                            // Calculate scaling factor for Y-offset based on font size
                            var fontScalingFactor = avgFontSize / standardFontSize;
                            var scaledYOffset = baseYOffset * fontScalingFactor;
                            
                            // Process each line
                            for (var l = 0; l < lines.length; l++) {
                                var lineText = lines[l];
                                
                                // Calculate line dimensions
                                var lineWidth = lineText.length * avgFontSize * 0.6;
                                
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
                                
                                // Apply scaling factor and add SCALED Y-offset for multiline text
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
                            // Single line fallback - use the whole frame WITHOUT Y-OFFSET
                            var yMin = Math.round(frameY1 * scaleFactor); // No Y-offset for single-line text
                            var xMin = Math.round(frameX1 * scaleFactor);
                            var yMax = Math.round(frameY2 * scaleFactor); // No Y-offset for single-line text
                            var xMax = Math.round(frameX2 * scaleFactor);
                            
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
                            var fallbackYOffset = hasLineBreaks ? baseYOffset : 0;
                            
                            // If multi-line, try to estimate font size for scaling
                            if (hasLineBreaks) {
                                try {
                                    var estFontSize = 12; // Default
                                    if (textFrame.paragraphs.length > 0) {
                                        estFontSize = textFrame.paragraphs[0].pointSize;
                                        // Scale Y-offset based on font size
                                        fallbackYOffset = baseYOffset * (estFontSize / standardFontSize);
                                    }
                                } catch (e) {
                                    // Use default
                                }
                            }
                            
                            // Convert to points and apply scaling with Y-offset only for multi-line text
                            var yMin = Math.round((frameBounds[0] * 72 + fallbackYOffset) * scaleFactor);
                            var xMin = Math.round(frameBounds[1] * 72 * scaleFactor);
                            var yMax = Math.round((frameBounds[2] * 72 + fallbackYOffset) * scaleFactor);
                            var xMax = Math.round(frameBounds[3] * 72 * scaleFactor);
                            
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
    
    // Format data for Label.txt and Cache.cach
    var ocrData = formatOCRData(jpgPathForLabels, textBoxes);
    
    // Write the OCR data to both files - append a newline if files already had content
    if (labelFileExists && labelFile.length > 0) {
        labelFile.write("\n" + ocrData);
    } else {
        labelFile.write(ocrData);
    }
    
    if (cacheFileExists && cacheFile.length > 0) {
        cacheFile.write("\n" + ocrData);
    } else {
        cacheFile.write(ocrData);
    }
    
    // Generate fileState.txt content - just one line for the actual JPG
    var fileStateContent = jpgPathForLabels + "\t1";
    
    // Add newline if file already exists and has content
    if (fileStateExists && fileStateFile.length > 0) {
        fileStateFile.write("\n" + fileStateContent);
    } else {
        fileStateFile.write(fileStateContent);
    }
    
    // Close all files
    labelFile.close();
    cacheFile.close();
    fileStateFile.close();
    
    alert("Text extraction complete!\n\n" + 
          "JPG and OCR training data saved to: " + ocrDataFolder.fsName + "\n" +
          "Created files: " + jpgBaseName + ", Label.txt, Cache.cach, fileState.txt\n\n" +
          "Found " + textBoxes.length + " text elements in the document\n" +
          "Using two different methods:\n" +
          "- Single-line text: using entire text frame coordinates (NO Y-OFFSET)\n" +
          "- Multi-line text: processing each line separately (WITH FONT-SCALED Y-OFFSET)\n" +
          "Base Y-offset: " + baseYOffset + " points (scaled based on font size)");
    
} catch (error) {
    alert("Error: " + error.message);
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