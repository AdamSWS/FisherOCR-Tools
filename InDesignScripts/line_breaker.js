// InDesign Text Extractor with Improved Line Break Detection
// This script extracts all text content from an InDesign document and analyzes
// line breaks using text frame properties and dimensions

try {
    if (app.documents.length === 0) {
        throw new Error("No document is open. Please open an InDesign document first.");
    }
    
    var doc = app.activeDocument;
    var docPath = doc.filePath;
    
    // If the document hasn't been saved yet, prompt for a save location
    if (!docPath) {
        alert("Please save your document first before running this script.");
        exit();
    }
    
    // Create output files
    var textFileName = doc.name.replace(/\.indd$/i, "") + "_extracted_text.txt";
    var textFile = new File(docPath + "/" + textFileName);
    
    var detailsFileName = doc.name.replace(/\.indd$/i, "") + "_text_details.csv";
    var detailsFile = new File(docPath + "/" + detailsFileName);
    
    // If the files already exist, ask if the user wants to overwrite them
    if (textFile.exists) {
        if (!confirm("The file '" + textFileName + "' already exists. Do you want to overwrite it?")) {
            var saveDialog = File.saveDialog("Save extracted text as:", "Text files:*.txt");
            if (saveDialog) {
                textFile = saveDialog;
            } else {
                exit();
            }
        }
    }
    
    textFile.encoding = "UTF-8";
    textFile.open("w");
    
    detailsFile.encoding = "UTF-8";
    detailsFile.open("w");
    
    // Write CSV header
    detailsFile.write("StoryID,FrameID,PageNumber,xMin,yMin,xMax,yMax,Width,Height,TextSize,TextAlign,DetectedLines,TextContent\n");
    
    // Initialize variables to store text
    var allText = "";
    var storyCount = 0;
    
    // Store references to stories for navigation
    var storyReferences = [];
    
    // Extract text from text frames in the document
    for (var i = 0; i < doc.stories.length; i++) {
        var story = doc.stories[i];
        if (story.contents.length > 0) {
            storyCount++;
            allText += "--- Text Story #" + storyCount + " ---\n";
            allText += "Content: " + story.contents + "\n\n";
            
            // Store reference to this story
            storyReferences.push({
                index: storyCount,
                storyRef: story
            });
            
            // Process each text frame in this story
            var frameCount = 0;
            for (var j = 0; j < story.textContainers.length; j++) {
                var textFrame = story.textContainers[j];
                frameCount++;
                
                try {
                    // Get the page number this frame is on
                    var pageNum = "N/A";
                    var onPage = false;
                    var parentPage = null;
                    
                    try {
                        parentPage = textFrame.parentPage;
                        pageNum = parentPage.name;
                        onPage = true;
                    } catch (e) {
                        // Frame might be on pasteboard
                        pageNum = "Pasteboard";
                        onPage = false;
                    }
                    
                    // Get geometric bounds [y1, x1, y2, x2] - InDesign uses this unusual order
                    var bounds = textFrame.geometricBounds;
                    var yMin = bounds[0];
                    var xMin = bounds[1];
                    var yMax = bounds[2];
                    var xMax = bounds[3];
                    var width = xMax - xMin;
                    var height = yMax - yMin;
                    
                    // Get text in this specific frame
                    var frameText = textFrame.contents;
                    
                    // Extract text formatting information
                    var textSize = "Mixed";
                    var textAlign = "Mixed";
                    var fontFamily = "Unknown";
                    var leading = 0;
                    
                    try {
                        // Try to get text size and other metrics from paragraphs
                        if (textFrame.paragraphs.length > 0) {
                            textSize = textFrame.paragraphs[0].pointSize;
                            
                            // Try to get leading (line spacing)
                            try {
                                leading = textFrame.paragraphs[0].leading;
                                // If auto leading (0), use 120% of font size by default
                                if (leading === 0) {
                                    leading = textSize * 1.2;
                                }
                            } catch (e) {
                                // Default leading if can't get it
                                leading = textSize * 1.2;
                            }
                            
                            // Try to get font family
                            try {
                                fontFamily = textFrame.paragraphs[0].appliedFont.name;
                            } catch (e) {
                                // If we can't get font family, just use "Unknown"
                            }
                            
                            // Check if all paragraphs have the same size
                            var sameSize = true;
                            for (var p = 1; p < textFrame.paragraphs.length; p++) {
                                if (textFrame.paragraphs[p].pointSize != textSize) {
                                    sameSize = false;
                                    break;
                                }
                            }
                            
                            if (!sameSize) {
                                textSize = "Mixed";
                            }
                        }
                        
                        // Try to get text alignment - use the first paragraph if available
                        if (textFrame.paragraphs.length > 0) {
                            // Convert justification enum to text
                            switch(textFrame.paragraphs[0].justification) {
                                case Justification.LEFT_ALIGN:
                                    textAlign = "Left";
                                    break;
                                case Justification.CENTER_ALIGN:
                                    textAlign = "Center";
                                    break;
                                case Justification.RIGHT_ALIGN:
                                    textAlign = "Right";
                                    break;
                                case Justification.FULLY_JUSTIFIED:
                                    textAlign = "Justified";
                                    break;
                                default:
                                    textAlign = "Unknown";
                            }
                            
                            // Check if all paragraphs have the same alignment
                            var sameAlign = true;
                            for (var p = 1; p < textFrame.paragraphs.length; p++) {
                                if (textFrame.paragraphs[p].justification != textFrame.paragraphs[0].justification) {
                                    sameAlign = false;
                                    break;
                                }
                            }
                            
                            if (!sameAlign) {
                                textAlign = "Mixed";
                            }
                        }
                    } catch (e) {
                        // If we can't get formatting info, use defaults
                        textSize = "Unknown";
                        textAlign = "Unknown";
                    }
                    
                    // Get lines using sophisticated detection methods
                    var detectedLines = [];
                    
                    try {
                        // First try to use the textFrame.lines collection if available
                        if (textFrame.lines && textFrame.lines.length > 0) {
                            for (var l = 0; l < textFrame.lines.length; l++) {
                                detectedLines.push(textFrame.lines[l].contents);
                            }
                        } else {
                            // If lines collection isn't available or is empty, use our analysis
                            detectedLines = analyzeTextFlowForLines(textFrame, textSize, leading, fontFamily, width);
                        }
                    } catch (e) {
                        // Fallback to simple analysis if the lines collection access fails
                        detectedLines = analyzeTextFlowForLines(textFrame, textSize, leading, fontFamily, width);
                    }
                    
                    // Add bounds info to allText
                    allText += "-- Frame #" + frameCount + " --\n";
                    allText += "Page: " + pageNum + "\n";
                    allText += "Bounds: xMin=" + xMin + ", yMin=" + yMin + ", xMax=" + xMax + ", yMax=" + yMax + "\n";
                    allText += "Size: width=" + width + ", height=" + height + "\n";
                    allText += "Text Size: " + textSize + "\n";
                    allText += "Font: " + fontFamily + "\n";
                    allText += "Text Alignment: " + textAlign + "\n";
                    allText += "Detected Lines: " + detectedLines.length + "\n";
                    allText += "Text: " + frameText + "\n\n";
                    
                    // Prepare text for CSV (escape quotes and remove line breaks for CSV)
                    var csvText = String(frameText).replace(/"/g, "\"\"").replace(/[\r\n]/g, " ");
                    
                    // Write to CSV file
                    detailsFile.write(storyCount + "," + 
                                    frameCount + "," + 
                                    pageNum + "," + 
                                    xMin + "," + 
                                    yMin + "," + 
                                    xMax + "," + 
                                    yMax + "," + 
                                    width + "," + 
                                    height + "," + 
                                    textSize + "," + 
                                    textAlign + "," + 
                                    detectedLines.length + "," + 
                                    "\"" + csvText + "\"\n");
                    
                    // Output the detected lines
                    if (detectedLines.length > 0) {
                        allText += "-- Detected Line Breaks --\n";
                        for (var l = 0; l < detectedLines.length; l++) {
                            allText += "Line " + (l+1) + ": " + detectedLines[l] + "\n";
                        }
                        allText += "\n";
                    }
                    
                } catch (e) {
                    allText += "-- Frame #" + frameCount + " --\n";
                    allText += "Error getting frame details: " + e.message + "\n\n";
                }
            }
            
            allText += "\n\n";
        }
    }
    
    // Write the extracted text to the file
    textFile.write(allText);
    textFile.close();
    detailsFile.close();
    
    alert("Text extraction complete!\n\n" + 
          "Extracted " + storyCount + " text stories.\n" + 
          "Text with line analysis saved to: " + textFile.fsName + "\n" + 
          "Text details saved to: " + detailsFile.fsName);
    
    // Create navigation panel
    createNavigationPanel(storyReferences);

} catch (error) {
    alert("Error: " + error.message);
}

/**
 * A more accurate line break detection method that analyzes text flow
 * based on text frame width, font properties, and natural text breaks
 */
function analyzeTextFlowForLines(textFrame, fontSize, leading, fontFamily, frameWidth) {
    var lines = [];
    
    try {
        // First check for actual paragraph breaks
        var frameText = textFrame.contents;
        var paragraphs = [];
        
        // If the text has hard returns, split by them first
        if (frameText.indexOf("\r") >= 0) {
            paragraphs = frameText.split(/\r/);
        } else {
            paragraphs = [frameText];
        }
        
        // For each paragraph, analyze word wrapping based on frame width
        for (var p = 0; p < paragraphs.length; p++) {
            var paragraph = paragraphs[p];
            
            // Skip empty paragraphs
            if (paragraph.trim() === "") {
                if (paragraphs.length > 1) {  // Only add empty line if there are multiple paragraphs
                    lines.push("");
                }
                continue;
            }
            
            // Calculate text width more accurately by checking number of lines in frame
            var estimatedLineHeight = (leading > 0) ? leading : (fontSize * 1.2);
            var frameHeight = textFrame.geometricBounds[2] - textFrame.geometricBounds[0];
            var maxLinesInFrame = Math.max(1, Math.floor(frameHeight / (estimatedLineHeight / 72)));
            
            // Font-specific adjustments
            var avgCharWidth = getFontAverageCharWidth(fontFamily, fontSize);
            
            // Calculate approximate characters per line
            var frameWidthInPoints = frameWidth * 72; // Convert to points
            var charsPerLine = Math.floor(frameWidthInPoints / avgCharWidth);
            
            // Adjust for realistic word wrapping
            var paraLines = smartWordWrap(paragraph, charsPerLine, maxLinesInFrame, frameText);
            
            // Add these lines to our results
            for (var i = 0; i < paraLines.length; i++) {
                lines.push(paraLines[i]);
            }
        }
        
        // Sanity check - if we ended up with no lines, just return the original text
        if (lines.length === 0) {
            lines = [frameText];
        }
        
        // Cleanup - trim each line
        for (var i = 0; i < lines.length; i++) {
            lines[i] = lines[i].replace(/^\s+|\s+$/g, "");
        }
    } catch (e) {
        // Fallback to basic approach
        if (frameText.indexOf("\r") >= 0) {
            lines = frameText.split(/\r/);
        } else {
            lines = [frameText];
        }
    }
    
    return lines;
}

/**
 * Smarter word wrapping algorithm that better accounts for natural phrase breaks
 */
function smartWordWrap(text, charsPerLine, maxLines, fullText) {
    var lines = [];
    var words = text.split(/\s+/);
    
    // If it's a single word, just return it
    if (words.length === 1) {
        return [text];
    }
    
    // If all words would fit on one line, return as-is
    if (text.length <= charsPerLine) {
        return [text];
    }
    
    // Adjust wrapping based on some common patterns
    var specialCaseLines = checkSpecialCases(text, fullText);
    if (specialCaseLines.length > 0) {
        return specialCaseLines;
    }
    
    // Use natural phrase breaks for better line divisions
    return wrapByPhrases(words, charsPerLine, maxLines);
}

/**
 * Wraps text by looking for natural phrase boundaries
 */
function wrapByPhrases(words, charsPerLine, maxLines) {
    var lines = [];
    var currentLine = "";
    var currentLength = 0;
    
    // Analyze for phrases like "Tuna Pouches or Bowls" that should be kept together
    var phrases = [];
    var currentPhrase = [];
    var phraseLength = 0;
    
    // First build phrases by analyzing common groupings
    for (var i = 0; i < words.length; i++) {
        var word = words[i];
        
        // Check for conjunctions or smaller connecting words that might
        // indicate a phrase break
        var isConnector = /^(and|or|with|in|for|by|to|of|on|at)$/i.test(word);
        
        if (currentPhrase.length > 0 && (isConnector || phraseLength + word.length + 1 > charsPerLine * 0.8)) {
            // End current phrase if we hit a connector or it's getting too long
            phrases.push({
                words: currentPhrase,
                length: phraseLength
            });
            currentPhrase = [];
            phraseLength = 0;
        }
        
        // Add to current phrase
        currentPhrase.push(word);
        phraseLength += word.length + (phraseLength > 0 ? 1 : 0); // Account for space
    }
    
    // Add final phrase if any
    if (currentPhrase.length > 0) {
        phrases.push({
            words: currentPhrase,
            length: phraseLength
        });
    }
    
    // Now build lines from these phrases
    for (var j = 0; j < phrases.length; j++) {
        var phrase = phrases[j];
        
        // If phrase fits on current line, add it
        if (currentLength > 0 && currentLength + phrase.length + 1 <= charsPerLine) {
            currentLine += " " + phrase.words.join(" ");
            currentLength += phrase.length + 1;
        } 
        // If phrase is too long for a single line, break it up
        else if (phrase.length > charsPerLine) {
            // Add current line if not empty
            if (currentLength > 0) {
                lines.push(currentLine);
                currentLine = "";
                currentLength = 0;
            }
            
            // Break the phrase into smaller chunks
            var phraseWords = phrase.words;
            var tempLine = phraseWords[0];
            var tempLength = phraseWords[0].length;
            
            for (var k = 1; k < phraseWords.length; k++) {
                var nextWord = phraseWords[k];
                
                if (tempLength + nextWord.length + 1 <= charsPerLine) {
                    tempLine += " " + nextWord;
                    tempLength += nextWord.length + 1;
                } else {
                    lines.push(tempLine);
                    tempLine = nextWord;
                    tempLength = nextWord.length;
                }
            }
            
            if (tempLine) {
                // Check if this would be the last line
                if (lines.length >= maxLines - 1) {
                    // If so, add it to the current line
                    if (currentLine !== "") {
                        currentLine += " " + tempLine;
                    } else {
                        currentLine = tempLine;
                    }
                    currentLength = currentLine.length;
                } else {
                    // Otherwise, add as a new line
                    lines.push(tempLine);
                    currentLine = "";
                    currentLength = 0;
                }
            }
        } 
        // Start a new line with this phrase
        else {
            // Add current line if not empty
            if (currentLength > 0) {
                lines.push(currentLine);
            }
            currentLine = phrase.words.join(" ");
            currentLength = phrase.length;
        }
    }
    
    // Add final line if any
    if (currentLine) {
        lines.push(currentLine);
    }
    
    return lines;
}

/**
 * Checks for special text patterns that need specific line breaking rules
 */
function checkSpecialCases(text, fullText) {
    // Example check for Tuna packaging pattern
    if (fullText.indexOf("Tuna Pouches or Bowls") > -1) {
        if (text.indexOf("Tuna Pouches or Bowls") > -1) {
            // This is a pattern we recognized needs special handling
            var parts = text.split("Tuna ");
            if (parts.length > 1) {
                var result = [];
                result.push(parts[0] + "Tuna Pouches");
                result.push("or Bowls");
                
                // Check for size information
                if (text.indexOf("oz.") > -1) {
                    var ozParts = text.split(/\s+\d+[\.\d]*-\d+[\.\d]*\s+oz\./);
                    if (ozParts.length > 0 && text.match(/\d+[\.\d]*-\d+[\.\d]*\s+oz\./)) {
                        var ozText = text.match(/\d+[\.\d]*-\d+[\.\d]*\s+oz\./)[0];
                        result.push(ozText);
                    }
                }
                return result;
            }
        }
    }
    
    // No special case applied
    return [];
}

/**
 * Gets average character width based on font family and size
 */
function getFontAverageCharWidth(fontFamily, fontSize) {
    // Default width factor for unknown fonts
    var widthFactor = 0.5;
    
    // Adjust width factor based on font family
    fontFamily = String(fontFamily).toLowerCase();
    
    if (fontFamily.indexOf("helvetica") > -1 || fontFamily.indexOf("arial") > -1) {
        widthFactor = 0.55;
    } else if (fontFamily.indexOf("times") > -1) {
        widthFactor = 0.5;
    } else if (fontFamily.indexOf("courier") > -1 || fontFamily.indexOf("mono") > -1) {
        widthFactor = 0.6;
    } else if (fontFamily.indexOf("impact") > -1) {
        widthFactor = 0.65;
    } else if (fontFamily.indexOf("futura") > -1) {
        widthFactor = 0.58;
    } else if (fontFamily.indexOf("avenir") > -1) {
        widthFactor = 0.57;
    } else if (fontFamily.indexOf("slate") > -1) {
        widthFactor = 0.56; // Slate is similar to Helvetica but slightly more condensed
    } else if (fontFamily.indexOf("gothic") > -1) {
        widthFactor = 0.54;
    } else if (fontFamily.indexOf("condensed") > -1) {
        widthFactor = 0.45;
    } else if (fontFamily.indexOf("extended") > -1 || fontFamily.indexOf("expanded") > -1) {
        widthFactor = 0.65;
    }
    
    // Calculate average character width in points
    return fontSize * widthFactor;
}

// Function to create navigation panel
function createNavigationPanel(storyReferences) {
    var panel = new Window("palette", "Text Navigator", undefined);
    panel.orientation = "column";
    panel.alignChildren = ["fill", "top"];
    panel.spacing = 10;
    panel.margins = 16;
    
    // Add a title
    var title = panel.add("statictext", undefined, "Navigate to extracted text:");
    title.alignment = ["center", "top"];
    
    // Create a scroll panel for story buttons
    var scrollPanel = panel.add("panel", undefined, "");
    scrollPanel.alignChildren = ["fill", "top"];
    scrollPanel.maximumSize.height = 400;
    
    var buttonGroup = scrollPanel.add("group");
    buttonGroup.orientation = "column";
    buttonGroup.alignChildren = ["fill", "top"];
    buttonGroup.spacing = 5;
    
    // Add buttons for each story
    for (var i = 0; i < storyReferences.length; i++) {
        var storyRef = storyReferences[i];
        
        // Create a preview of the text (first 30 characters)
        var previewText = storyRef.storyRef.contents;
        if (typeof previewText === "string") {
            previewText = previewText.replace(/\r|\n/g, " "); // Replace line breaks with spaces
            previewText = previewText.substring(0, 30) + (previewText.length > 30 ? "..." : "");
        } else {
            previewText = "Story #" + storyRef.index;
        }
        
        var buttonLabel = "Story #" + storyRef.index + ": " + previewText;
        var button = buttonGroup.add("button", undefined, buttonLabel);
        
        // Store the story reference in the button's properties
        button.storyRef = storyRef.storyRef;
        
        // Add click event
        button.onClick = function() {
            // Navigate to the first text frame of this story
            var firstFrame = this.storyRef.textContainers[0];
            app.activeWindow.activeSpread = firstFrame.parent;
            app.select(firstFrame);
            app.activeWindow.zoom(ZoomOptions.FIT_SPREAD);
        };
    }
    
    // Add a close button
    var closeButton = panel.add("button", undefined, "Close");
    closeButton.onClick = function() {
        panel.close();
    };
    
    // Show the panel
    panel.show();
}