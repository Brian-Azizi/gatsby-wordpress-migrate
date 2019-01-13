import cheerio from 'cheerio';
import TurndownService from 'turndown';
import chalk from 'chalk';
import writing from './writing';

// Custom Styling for Command Line printing

const { log } = console;
const { yellow: progress } = chalk;

/* *********** Turndown Initializing ********** */

const turndownService = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
});

// Pre tag => PrismJS for gatsby plugin
turndownService.addRule('pre-tags', {
  filter: 'pre',
  replacement(value) {
    // Remove Escape Characters from String
    // created by TurndownService.prototype.escape
    // Unfortenately node is private in Turndown.js
    const content = value.replace(/\\/g, '');

    // Check if there is a Newline character to make the comment inline
    return content.split('\n').length > 1
      ? `\n\`\`\`\n${content}\n\`\`\`\n`
      : ` \`${content}\` `;
  },
});

// Code tag => PrismJS for gatsby plugin
turndownService.addRule('code-tags', {
  filter: 'code',
  replacement(content) {
    return content.split('\n').length > 1
      ? `\n\`\`\`\n${content}\n\`\`\`\n`
      : ` \`${content}\` `;
  },
});

// Strong tag fixes
turndownService.addRule('strong', {
  filter: 'strong',
  replacement(content) {
    return `**${content.trim()}** `;
  },
});

/* parseImages(value)
 * value : The content of the post with all the tags inside
 * return : [{url: <URL of the image>, fileName: <The UUID name generated>},...]
 */

const parseImages = value => {
  const content = cheerio.load(value);
  const imagesElements = content('img');
  const images = imagesElements
    .map((index, { attribs: { src: imageURL, ...rest } }) => ({
      fileName: imageURL.substring(imageURL.lastIndexOf('/') + 1),
      url: imageURL,
      ...rest,
    }))
    .toArray();

  return images;
};

const dataWrangle = async (data, destination) => {
  // Iterate in every Post
  data.rss.channel[0].item.map((post, index) => {
    log(progress(`Currently Parsing Post No: ${index + 1}`));
    console.log(post);
    let content = post['content:encoded'][0];
    const images = parseImages(content);
    images.forEach(image => {
      content = content.replace(new RegExp(image.url, 'g'), image.fileName);
    });

    content = turndownService.turndown(content);

    const header = {
      title: `'${post.title[0]}'`,
      date: post.pubDate[0],
      author: post['dc:creator'][0],
      slug: post['wp:post_name'][0],
      tags: post.category.reduce(
        (accumulator, current) =>
          `${accumulator ? `${accumulator},` : ''}${current.$.nicename}`,
        '',
      ),
      excerpt: `'${post['excerpt:encoded'][0]}'`,
    };

    console.log(images);
    console.log(header);

    return writing(header, images, content, destination);
  });
};

export default { dataWrangle };
