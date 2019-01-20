const cheerio = require('cheerio');
const { get, findIndex } = require('lodash');
const chalk = require('chalk');
const moment = require('moment');
const TurndownService = require('turndown');
const writing = require('./writing');

const { log } = console;
const { yellow: progress } = chalk;

TOTAL_IMAGES = 0;
IMAGE_COUNT = 0;
IMAGE_ERRORS = 0;

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

// Strong tag fix es
turndownService.addRule('strong', {
  filter: 'strong',
  replacement(content) {
    return `**${content.trim()}**`;
  },
});

// Strong tag fixes
turndownService.addRule('span', {
  filter(node) {
    return node.nodeName === 'SPAN' && get(node, 'attributes[0].value');
  },
  replacement(content, node) {
    return `<span style="${node.attributes[0].value}">${content}</span>`;
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
    .filter((index, img) => !!img.attribs.src)
    .map((index, { attribs: { src: imageURL, ...rest } }) => ({
      fileName: imageURL.substring(imageURL.lastIndexOf('/') + 1),
      url: imageURL,
      ...rest,
    }))
    .toArray();
  return images;
};

const dataWrangle = async (data, destination) => {
  const getThumbnail = thumbnailId => {
    log(`THUMBNAIL ID: ${thumbnailId}`);
    if (!thumbnailId) return null;

    const thumbnail = data.rss.channel[0].item.find(
      post => post['wp:post_id'][0] === thumbnailId,
    )['wp:attachment_url'][0];

    return {
      url: thumbnail,
      fileName: thumbnail.substring(thumbnail.lastIndexOf('/') + 1),
    };
  };

  // Iterate in every Post
  data.rss.channel[0].item
    .filter(post => !!post.category)
    .filter(post => get(post, `['wp:status'][0]`) === 'publish')
    .map((post, index) => {
      log(progress(`Currently Parsing Post No: ${index + 1}`));

      const getMeta = (key, defaultMeta = undefined) => {
        const metaIndex = findIndex(
          post['wp:postmeta'],
          meta => meta['wp:meta_key'][0] === key,
        );
        return metaIndex !== -1
          ? get(post, `['wp:postmeta'][${metaIndex}]['wp:meta_value'][0]`)
          : defaultMeta;
      };

      let content = post['content:encoded'][0];
      const images = parseImages(content);
      images.forEach(image => {
        content = content.replace(
          new RegExp(image.url, 'g'),
          `./${image.fileName}`,
        );
      });
      const thumbnail = getThumbnail(getMeta('_thumbnail_id'));
      if (thumbnail) images.unshift(thumbnail);

      content = turndownService.turndown(content);

      const header = {
        title: `"${get(post, 'title[0]')}"`,
        thumbnail: thumbnail ? thumbnail.url : undefined,
        author: get(post, `['dc:creator'][0]`),
        date: moment(get(post, 'pubDate[0]')).format(),
        categories: `[${post.category.map(
          (category, categoriesIndex) =>
            `${categoriesIndex > 0 ? ' ' : ''}"${category._}"`,
        )}]`,
        slug: get(post, `['wp:post_name'][0]`) || undefined,
        excerpt: get(post, `['excerpt:encoded'][0]`)
          ? `"${get(post, `['excerpt:encoded'][0]`)}"`
          : undefined,
        meta_title: `"${getMeta('_yoast_wpseo_title', get(post, 'title[0]'))}"`,
        seo_description: getMeta('_yoast_wpseo_metadesc'),
        seo_keywords: getMeta('_yoast_wpseo_focuskw'),
      };

      TOTAL_IMAGES += images.length;

      return writing(header, images, content, destination);
    });
};

module.exports = { dataWrangle };
