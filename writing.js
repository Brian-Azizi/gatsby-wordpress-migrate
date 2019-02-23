const fs = require('fs-extra');
const fetch = require('node-fetch');
const path = require('path');
const shortid = require('shortid');
const chalk = require('chalk');

const success = chalk.bold.green.inverse;
const { log } = console;
const error = chalk.bold.red;

/** writing.js
 * header: {title, slug, author, tags...}
 * images:  [{fileName, alt, ...}, ...]
 * content: the content of the post converted to the proper markdown
 * dest: the destination folder
 */

function writing(header, images, content, dest) {
  const destination = path.isAbsolute(dest)
    ? dest
    : [process.cwd(), path.normalize(dest)].join('/');

  // Create the destination folder exists
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination);
  }

  const finalDestinationFolder = [destination, header.slug].join('/');

  let srcPath = finalDestinationFolder;

  // Create the proper folder structure for the unique post
  if (!header.slug) {
    srcPath = `${destination}/draft.${shortid.generate()}`;
    fs.mkdirSync(srcPath);
  } else if (!fs.existsSync(finalDestinationFolder)) {
    fs.mkdirSync(srcPath);
  }
  const post = `---\n${Object.keys(header).reduce(
    (acc, key) =>
      header[key] !== undefined ? `${acc}${key}: ${header[key]}\n` : acc,
    '',
  )}---\n\n${content}`;

  // Writing the markdowns inside the folders
  fs.outputFile(`${srcPath}/index.md`, post, err => {
    if (err) {
      return log(error(err));
    }
    return log(success(`The post ${header.title} was successfully converted.`));
  });

  // Fetching the Images from the URLs
  // Here I encode URI in order to convert Unescaped Characters
  log('Downloading images...');
  images.forEach(async image => {
    fetch(encodeURI(image.url), { timeout: 1000 * 60 * 10 })
      .then(res => {
        const file = fs.createWriteStream(`${srcPath}/${image.fileName}`);
        res.body.pipe(file);
        IMAGE_COUNT += 1;
        log(
          success(
            `Image ${IMAGE_COUNT}/${TOTAL_IMAGES}: The image ${
              image.url
            } was successfully downloaded.`,
          ),
        );
      })
      .catch(err => {
        IMAGE_ERRORS += 1;
        log(error(`Error #${IMAGE_ERRORS} in post ${header.title}: ${err}`));
      });
  });
}

function writeAuthors(login, author, dest) {
  const destination = path.isAbsolute(dest)
    ? dest
    : [process.cwd(), path.normalize(dest)].join('/');

  // Create the destination folder exists
  if (!fs.existsSync(destination)) {
    fs.mkdirSync(destination);
  }

  const authorContent = JSON.stringify(
    {
      author,
      bio: null,
      picture: null,
    },
    null,
    4,
  );

  // Writing the markdowns inside the folders
  fs.outputFile(
    `${destination}/${login.split('@')[0]}.json`,
    authorContent,
    err => {
      if (err) {
        return log(error(err));
      }
      return log(success(`The author ${login} was successfully extracted.`));
    },
  );
}

module.exports = { writing, writeAuthors };
