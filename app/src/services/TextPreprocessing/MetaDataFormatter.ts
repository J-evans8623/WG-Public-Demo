/**
 * @file MetaDataFormatter.ts
 * @description
 *   Provides a utility function to convert a lesson module's metadata object
 *   into a human-readable formatted string, along with a final warning message.
 *
 *   The metadata object is expected to have the following structure:
 *   {
 *     main_topic: {
 *       title: string,
 *       subtopics: Array<{
 *         title: string,
 *         subtopics: Array<{ title: string }>
 *       }>
 *     },
 *     summary: string
 *   }
 *
 *   Example Output:
 *
 *   Main topic: [Main Topic Title]
 *   i. Primary Subtopic: [Primary Subtopic Title]
 *      a. Secondary Subtopic: [Secondary Subtopic Title]
 *      b. Secondary Subtopic: [Secondary Subtopic Title]
 *   ii. Primary Subtopic: [Primary Subtopic Title]
 *      Subtopics: null
 *
 *   At the end, a line is appended:
 *   "You have been given a total of X primary subtopics and Y secondary subtopics. You must cover each topic requested by the user!"
 *
 * @author
 * @date
 */

export function formatLessonMetadata(metadata: any): string {
  if (!metadata || !metadata.main_topic) {
    return "No metadata available.";
  }

  // Helper arrays for roman and letter numbering.
  const romanNumerals = ["i", "ii", "iii", "iv", "v", "vi", "vii", "viii", "ix", "x"];
  const alphabet = "abcdefghijklmnopqrstuvwxyz".split("");

  // Track total primary and secondary subtopics for the final warning message.
  let totalPrimary = 0;
  let totalSecondary = 0;

  // Step 1: Format main topic.
  let formattedString = `Main topic: ${metadata.main_topic.title}\n`;

  // Step 2: Iterate over primary subtopics.
  if (Array.isArray(metadata.main_topic.subtopics) && metadata.main_topic.subtopics.length > 0) {
    metadata.main_topic.subtopics.forEach((primarySubtopic: any, index: number) => {
      // Increment primary subtopic count.
      totalPrimary++;

      // Use roman numeral for the primary subtopic with explicit prefix.
      const primaryNumber = romanNumerals[index] || (index + 1).toString();
      formattedString += `${primaryNumber}. Primary Subtopic: ${primarySubtopic.title}\n`;

      // Step 3: Check and format secondary subtopics.
      if (Array.isArray(primarySubtopic.subtopics) && primarySubtopic.subtopics.length > 0) {
        primarySubtopic.subtopics.forEach((secondarySubtopic: any, secIndex: number) => {
          // Increment secondary subtopic count.
          totalSecondary++;

          // Use letter numbering for secondary subtopics with explicit prefix.
          const secondaryLetter = alphabet[secIndex] || (secIndex + 1).toString();
          formattedString += `   ${secondaryLetter}. Secondary Subtopic: ${secondarySubtopic.title}\n`;
        });
      } else {
        // Indicate that there are no secondary subtopics.
        formattedString += `   Subtopics: null\n`;
      }
    });
  } else {
    formattedString += `Subtopics: null\n`;
  }

  // Step 4: Append the final warning message.
  formattedString += `\nYou have been given a total of ${totalPrimary} primary subtopics and ${totalSecondary} secondary subtopics. You must cover each topic requested by the user!\n`;

  return formattedString;
}
