import React, { Component } from 'react';
import axios from 'axios';

import Meter from '../common/Meter.jsx';

export default class Uploader extends Component {

  constructor(props) {
    super(props);
    this.state = this._emptyState(props);
    this.start();
  }

  _emptyState(props) {
    return {
      files: props.files,
      remoteSource: props.url,
      phase: 'Uploading',
      totalSize: props.files.reduce((total, f) => total + f.size, 0),
      filepartIds: (props.files.length > 0) ? props.files.map(() => null) : [ null ],
      uploadId: null,
      uploadStatus: (props.files.length > 0) ? props.files.map(() => 'UPLOADING') : [ 'UPLOADING'],
      progress: (props.files.length > 0) ? props.files.map(() => 0) : [ 0 ],
      errors: []
    };
  }

  componentWillReceiveProps(next) {
    if (this.props.files == next.files && this.props.url == next.url)
      return;

    this.setState(this._emptyState(next), () => this.start());
  }

  /** 
   * Starts a new upload.
   * 
   * Since one document generally consists of multiple files, the 
   * upload process is multi-stage: 
   * 
   * - first, the new document is initialized, and assigned an ID on the server
   * - then, all files are uploaded to this document
   * - finally, a finalization requests closes the document, and waits for any
   *   processing (image tiling, TEI conversion) to finish
   */
  start() {
    this.initNewDocument()
      .then((result) => { 
        this.setState({ uploadId: result.data.id });

        // Branch based on files vs. remote URL
        if (this.state.files.length > 0)
          return this.uploadFiles() 
        else if (this.state.remoteSource)
          return this.registerURL()
      })
      .catch(error => {
        this.setState(prev => {
          const errors = prev.errors.slice(0);
          errors.push(error.response.data);
          return { errors: errors };
        });
      })
      .then(this.finalizeDocument.bind(this));
  }

  /**
   * Initializes a new document, using the filename as title,
   * or a 'New document' placeholder in case there are multiple files.
   */
  initNewDocument() {
    const title = (this.state.files.length == 1) ? this.state.files[0].name : 'New document';
    const formdata = new FormData();
    formdata.append('title', title);

    return axios.post('/my/upload', formdata, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
  }

  registerURL() {
    this.setState({ phase: 'Importing' });

    const formdata = new FormData();
    formdata.append('url', this.state.remoteSource);

    return axios.post(`/my/upload/${this.state.uploadId}/file`, formdata, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    });
  }

  /**
   * Uploads the files in parallel.
   */
  uploadFiles() {
    // Helper: handles upload for one file
    const uploadOne = (file, idx) => {
      const formdata = new FormData();
      formdata.append('file', file);

      const onUploadProgress = (evt) => {
        const progress = this.state.progress.slice(0); // Clone progress array
        progress[idx] = evt.loaded;
        this.setState({ progress: progress });
      }

      return axios.post(`/my/upload/${this.state.uploadId}/file`, formdata, {
        headers: { 'X-Requested-With': 'XMLHttpRequest' },
        onUploadProgress: onUploadProgress
      }).then(result => {
        this.setState(prev => {
          const filepartIds = prev.filepartIds.slice(0);
          filepartIds[idx] = result.data.uuid;
          return { filepartIds: filepartIds };
        });

        return result;
      }).catch(error => {
        this.setState(prev => {
          const uploadStatus = prev.uploadStatus.slice(0);
          uploadStatus[idx] = 'FAILED';

          const errors = prev.errors.slice(0);
          errors.push(error.response.data);

          return { 
            uploadStatus: uploadStatus,
            errors: errors 
          };
        });
      });
    }
    
    // The list of request promises...
    const requests = this.state.files.map((file, idx) => uploadOne(file, idx));

    // ... rolled into a promise of the list of request results
    return Promise.all(requests);
  }

  /**
   * Finalizes the upload, creating the document and starting processing tasks (if any)
   */
  finalizeDocument()  {
    return axios.post(`/my/upload/${this.state.uploadId}/finalize`, {
      headers: { 'X-Requested-With': 'XMLHttpRequest' }
    }).then(result => {
      const tasks = result.data.running_tasks;
      if (tasks.length > 0) {
        this.setState({ phase: 'Importing...' });
        this.pollTaskProgress(result.data.document_id, tasks);
      } else {
        this.props.onUploadComplete();
      }
    }).catch(error => {
      console.log('Upload contained errors');
    });
  }

  updateStatusForFile(filepartId, pollResult) {
    const progress = pollResult.subtasks.find(t => t.filepart_id == filepartId);
    const idx = this.state.filepartIds.indexOf(filepartId);

    const setUploadStatus = (value) => {
      this.setState(prev => {
        const uploadStatus = prev.uploadStatus.slice(0);
        uploadStatus[idx] = value;
        return { uploadStatus: uploadStatus };
      })
    }

    if (progress)
      setUploadStatus(progress.status);
    else // No task running for this file - complete
      setUploadStatus('COMPLETED');
  }

  /**
   * Polls import task progress
   */
  pollTaskProgress(documentId, taskTypes) {    
    axios.get(`/api/task?id=${documentId}`)
      .then(result => {
        // Update status per file
        this.state.filepartIds.map(id => this.updateStatusForFile(id, result.data));
        const isDone = result.data.status == 'COMPLETED' || result.data.status == 'FAILED';
        if (isDone)
          this.props.onUploadComplete()
        else
          setTimeout(() => this.pollTaskProgress(documentId, taskTypes), 1000);
      });
  }

  isUploadComplete() {
    return this.state.uploadStatus
      .reduce((complete, next) => complete && (next == 'COMPLETED' || next == 'FAILED'));
  }

  onCancel(evt) {
    if (this.isUploadComplete())
      this.props.onUploadComplete();
  }

  render() {
    const totalLoaded = this.state.progress.reduce((total, next) => total + next, 0);

    return (
      <div className="upload-progress">
        <div className="phase">
          {this.state.phase}
          <button 
            className="close nostyle"
            onClick={this.onCancel.bind(this)}>&#xe897;</button>
        </div>
        <ul className={`files${(this.state.errors.length > 0) ? ' has-errors' : ''}`}>
          {this.state.files.map((f, idx) =>
            <li key={idx}>
              {f.name}
              <span className={`icon spinner ${this.state.uploadStatus[idx]}`}></span>
            </li>
          )}

          {this.state.remoteSource &&
            <li>
              Fetching content from remote source...
              <span className="icon spinner RUNNING"></span>
            </li>
          }
        </ul>
        {this.state.errors.length > 0 && 
          <ul className="errors">
            {this.state.errors.map((message, idx) => <li key={idx}>{message}</li>)}
          </ul>
        }
        <div className="progress">
          <Meter value={totalLoaded / this.state.totalSize} />
        </div>
      </div>
    )
  }

}