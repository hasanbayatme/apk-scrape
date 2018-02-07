const fs = require('fs');
const path = require('path');
const got = require('got');
const util = require('util');
const mkdirp = require('mkdirp');
const cheerio = require('cheerio');
const program = require('commander');
const async = require('async');

program
  .version('1.0.0')
  .description('a simple script for downloading apk files using their package identifier')
  .usage('[options]')
  .option('-r, --report', 'add this flag to log the reports')
  .option('-p, --packages-file [path]', 'the path to the file that contains the packages identifier', './packages.txt')
  .option('-d, --download-folder [path]', 'the path to the folder for storing downloaded apks', './download')
  .option('-l, --limit [number]', 'the number of packages to download in parallel', 3)
  .parse(process.argv);

let packagesFilePath = program.packagesFile;
let downloadFolderPath = program.downloadFolder;
let domain = 'https://apkpure.com';
let searchUrl = domain + '/search?q=%s';
let report = program.report | false;
let limit = program.limit;

fs.readFile(packagesFilePath, 'utf-8', (err, data) => {
  if (err) {
    throw err;
  }
  mkdirp(downloadFolderPath, (err) => {
    if (err) {
      throw err;
    }
    let packages = data.toString().split(/\r?\n/);
    async.eachLimit(packages, limit, (packageName, cb) => {
      if (packageName) {
        downloadPackage(packageName, cb);
      }
    }, (err) => {
      throw err;
    });
  });
});

function downloadPackage(packageName, cb) {
  getDirectDownloadUrl(packageName, (directUrl) => {
    log(`Downloading ${packageName} package...`);
    let stream = got.stream(directUrl);
    stream.on('response', response => {
      let fileName = response.headers['content-disposition'].match(/filename="(.*)"/)[1];
      stream.pipe(fs.createWriteStream(path.resolve(downloadFolderPath, fileName)));
    });
    stream.on('downloadProgress', progress => {
      log(`Downloading ${packageName} %${(progress.percent * 100).toFixed(2)}...`);
    });
  });
}

function getDirectDownloadUrl (packageName, cb) {
  getDownloadUrl(packageName, (downloadUrl) => {
    log(`Fetching direct download url for ${packageName}...`);
    got(downloadUrl).then((response) => {
      const $ = cheerio.load(response.body);
      let directUrl = $('a#download_link').attr('href');
      log(`Direct Download URL is: ${directUrl}`);
      cb(directUrl);
    });
  });
}

function getDownloadUrl (packageName, cb) {
  getPackageUrl(packageName, (packageUrl) => {
    log(`Fetching download url for ${packageName}...`);
    got(packageUrl).then((response) => {
      const $ = cheerio.load(response.body);
      let downloadUrl = domain + $('div.ny-down > a').attr('href');
      log(`Download URL is: ${downloadUrl}`);
      cb(downloadUrl);
    });
  });
}

function getPackageUrl(packageName, cb) {
  log(`Fetching package url for ${packageName}...`);
  let url = util.format(searchUrl, packageName);
  got(url).then((response) => {
    const $ = cheerio.load(response.body);
    let packageUrl = domain + $('div#search-res > dl > dt > a').attr('href');
    log(`Package URL is: ${packageUrl}`);
    cb(packageUrl);
  });
}

function log (message) {
  if (report) {
    console.log(message);
  }
}
