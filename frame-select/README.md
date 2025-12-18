### Installation

1. Create and activate virtual environment:
```bash
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

2. Install dependencies:
```bash
pip install -r requirements.txt
npm install
```

### Setup
1. After cloning this repository, open 2 terminals. Make sure you are in the frame-select/backend folder in one and in the other make sure you are in the frame-select/frontend folder. 

 In the terminal with the backend folder, run the backend starting commmand:

python -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload

In the other terminal run this:

npm run dev

2. You should see the backend and frontend running! Next, the localhost:3000 website takes some time to load but once it does, upload the test pictures from the folder. 

3. It will analyze the pictures as seen by a loading screen and then bring you to a main page with all the tags and rankings. On the top, you can see the model's duplicate detection results and can auto-remove duplicates if you wish. Below, you can see the ranked list of images. You can hover over a image to select it for exporting or select a general top 10 or top 25 of the ranked list. There are multiple filters to narrow down the pictures you want exported. If you want to see a certain picture's details, you can hover over that picture and select the deep analysis tab in the lower right corner. You will be able to see percentages of metrics analyzed as well as graphs for each photography technique that can help photographers analyze an image to see if is a good image. 

4. You can then go back to the Results page and once you select and click export for the images you want to download, the application will send a zipped folder to your Downloads that you can then send to Lightroom or other photo editing software to hone down on. 

