const FormData = require("form-data");
const fetch = require("node-fetch");
const path = require("path");
const basePath = process.cwd();
const fs = require("fs");

const AUTH = process.env.API_KEY;
const TIMEOUT = 1000; 

const allMetadata = [];

async function uploadImageToIPFS(user_name) {
    let imageURLs = [];
  const files = fs.readdirSync(`${basePath}/${user_name}/build/images`);
  files.sort(function(a, b){
    return a.split(".")[0] - b.split(".")[0];
  });
  for (const file of files) {
    const fileName = path.parse(file).name;
    let jsonFile = fs.readFileSync(`${basePath}/${user_name}/build/json/${fileName}.json`);
    let metaData = JSON.parse(jsonFile);
    if(!metaData.file_url.includes('https://')) {
      const response = await fetchWithRetry(file, user_name);
      metaData.file_url = response.ipfs_url;
      imageURLs.push(response.ipfs_url);
      fs.writeFileSync(
        `${basePath}/${user_name}/build/json/${fileName}.json`,
        JSON.stringify(metaData, null, 2)
      );
      console.log(`${response.file_name} uploaded & ${fileName}.json updated!`);
    } else {
      console.log(`${fileName} already uploaded.`);
    }

    allMetadata.push(metaData);
  }
  fs.writeFileSync(
    `${basePath}/${user_name}/build/json/_metadata.json`,
    JSON.stringify(allMetadata, null, 2)
  );
  return imageURLs;
}

function timer(ms) {
  return new Promise(res => setTimeout(res, ms));
}

async function fetchWithRetry(file, user_name)  {
  await timer(TIMEOUT)
  return new Promise((resolve, reject) => {
    const fetch_retry = (_file) => {
      const formData = new FormData();
      const fileStream = fs.createReadStream(`${basePath}/${user_name}/build/images/${_file}`);
      formData.append("file", fileStream);

      let url = "https://api.nftport.xyz/v0/files";
      let options = {
        method: "POST",
        headers: {
          Authorization: AUTH,
        },
        body: formData,
      };

      return fetch(url, options).then(async (res) => {
          const status = res.status;

          if(status === 200) {
            return res.json();
          }            
          else {
            console.error(`ERROR STATUS: ${status}`)
            console.log('Retrying')
            await timer(TIMEOUT)
            fetch_retry(_file)
          }            
      })
      .then(async (json) => {
        if(json.response === "OK"){
          return resolve(json);
        } else {
          console.error(`NOK: ${json.error}`)
          console.log('Retrying')
          await timer(TIMEOUT)
          fetch_retry(_file)
        }
      })
      .catch(async (error) => {  
        console.error(`CATCH ERROR: ${error}`)  
        console.log('Retrying')    
        await timer(TIMEOUT)    
        fetch_retry(_file)
      });
    }        
    return fetch_retry(file);
  });
}

module.exports = {uploadImageToIPFS};