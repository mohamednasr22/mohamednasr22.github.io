import { Component, OnInit, ViewChild, TemplateRef, ElementRef, AfterViewInit } from '@angular/core';
import { MatTableDataSource } from '@angular/material/table';
import { FormControl } from '@angular/forms';
import { Observable , of as observableOf, Subject, merge } from 'rxjs';
import {map, startWith, tap, debounceTime, switchMap, catchError} from 'rxjs/operators';
import { MatDialog } from '@angular/material/dialog';
import { GalleryComponent } from '../../../shared/component/gallery/gallery.component';
import { GeneralItem } from '../../../models/GeneralItem';
import { ContainerService } from '../../../shared/services/container.service';
import { ManagerService } from '../../../shared/services/manager.service';
import { Container } from '../../../models/container';
import { ConfirmComponent } from '../../../shared/modal/confirm/confirm.component';
import { FilesComponent } from '../../../shared/component/files/files.component';
import { AuthenticationService } from '../../../services/authentication.service';

import { Gallery, GalleryItem, ImageItem, ThumbnailsPosition, ImageSize } from '@ngx-gallery/core';
import { Lightbox } from '@ngx-gallery/lightbox';

import { ExportAsService, ExportAsConfig } from 'ngx-export-as';
import { MatSort } from '@angular/material/sort';
import { MatPaginator } from '@angular/material/paginator';


@Component({
  selector: 'app-containers',
  templateUrl: './containers.component.html',
  styleUrls: ['./containers.component.scss']
})
export class ContainersComponent implements OnInit , AfterViewInit {

  @ViewChild(MatSort) sort: MatSort;
  @ViewChild(MatPaginator) paginator: MatPaginator;

  @ViewChild('itemTemplate') itemTemplate: TemplateRef<any>;

  @ViewChild('content', { read: ElementRef }) content:ElementRef;

  exportAsConfig:ExportAsConfig = {
    type: 'pdf',
    elementIdOrContent: 'content'
  };

  callSubject:Subject<void>;

  gallery_items: GalleryItem[];

  lightboxRef = null;

  loaded = false;

  isLoadingResults = true;
  isRateLimitReached = false;
  resultsLength = 0;
  pageSize = 20;


  container_statuses:GeneralItem[] = [];
  containerStatusId:FormControl = new FormControl('');
  bookingNo:FormControl = new FormControl();
  containerNo:FormControl = new FormControl();
  polCtrl:FormControl = new FormControl();
  podCtrl:FormControl = new FormControl();

  searchTerms = {
    booking_no : '',
    container_no : '',
    container_status_id : '',
    port_of_loading : '',
    port_of_discharge : ''
  };


  displayedColumns: string[] = ['booking_no' , 'id', 'port_of_loading' , 'port_of_discharge' , 'sailing_date', 'courier', 'eta', 'status', 'files' , 'image' , 'view','update','delete'];
  dataSource:MatTableDataSource<Container> = new MatTableDataSource<Container>();

  container_no:FormControl = new FormControl();
  booking_no:FormControl = new FormControl();

  pms:any;


  constructor(private exportAsService: ExportAsService,public dialog: MatDialog , private _manager:ManagerService , private containerService:ContainerService , private auth:AuthenticationService , public gallery: Gallery, public lightbox: Lightbox) {
    if(auth.currentUserValue.permission){
      this.pms = auth.currentUserValue.permission.container;
      let filteredPermission = ['booking_no' , 'container_no', 'port_of_loading' , 'port_of_discharge' , 'sailing_date', 'courier', 'eta', 'status'];

      if(this.pms.view){
        filteredPermission.push('view');
      }

      filteredPermission.push('actions');

      /*
      if(this.pms.update){
        filteredPermission.push('update');
      }
      if(this.pms.delete){
        filteredPermission.push('delete');
      }
      */
      this.displayedColumns = filteredPermission;
    }




  }

  ngOnInit(): void {

    this.callSubject = new Subject();
    this.callSubject.pipe(
      tap(() => {
        this.isLoadingResults = true;
      }),
      debounceTime(500)
    ).subscribe(() => {
      this.activeNavigation();
    });




    this.bookingNo.valueChanges.subscribe(data => {
      this.searchTerms.booking_no = data;
      this.applyFilter(data);
    });

    this.containerNo.valueChanges.subscribe(data => {
      this.searchTerms.container_no = data;
      this.applyFilter(data);
    });

    this.polCtrl.valueChanges.subscribe(data => {
      this.searchTerms.port_of_loading = data;
      this.applyFilter(data);
    });

    this.podCtrl.valueChanges.subscribe(data => {
      this.searchTerms.port_of_discharge = data;
      this.applyFilter(data);
    });

    this.containerStatusId.valueChanges.subscribe(data => {
      this.searchTerms.container_status_id = data;
      this.applyFilter(data);
    });




    this.lightboxRef = this.gallery.ref('lightbox');

    this.lightboxRef.setConfig({
      imageSize: ImageSize.Contain,
      thumbPosition: ThumbnailsPosition.Top,
      itemTemplate: this.itemTemplate,
      gestures: false
    });

  }

  ngAfterViewInit(){
    this.activeNavigation();
  }

  activeNavigation(){
    merge(this.sort.sortChange, this.paginator.page)
      .pipe(
        startWith({}),
        switchMap(() => {
          this.isLoadingResults = true;
          return this.containerService!.getContainers({sort : this.sort.active, order : this.sort.direction , pagesize : this.paginator.pageSize, page : this.paginator.pageIndex + 1 , filter : Object.keys(this.searchTerms).map(key => key + '___' + this.searchTerms[key]).join('|')});
        }),
        map(data => {
          this.isLoadingResults = false;
          this.isRateLimitReached = false;
          this.resultsLength = data.total;
          return data.items;

        }),
        catchError(() => {
          this.isLoadingResults = false;
          this.isRateLimitReached = true;
          return observableOf([]);
        })
      ).subscribe(data => {
        this.dataSource.data = data;
        if(!this.loaded){
          this._manager.getContainerStatuses().subscribe(data => {
            if(data){
              this.container_statuses = data.data;
            }
            this.loaded = true;
            setTimeout(() => {
              this.sort.sortChange.subscribe(() => this.paginator.pageIndex = 0);
            }, 0);
          });
        }
      });
  }

  applyFilter(val) {
    let filterValue = val.toString();
    this.paginator.pageIndex = 0;
    filterValue = filterValue.trim();
    filterValue = filterValue.toLowerCase();
    this.callSubject.next();
  }

  resetFilter(){
    this.searchTerms = {
      booking_no : '',
      container_no : '',
      container_status_id : '',
      port_of_loading : '',
      port_of_discharge : ''
    };

    this.containerStatusId.setValue('');
    this.podCtrl.setValue('');
    this.polCtrl.setValue('');
    this.containerNo.setValue('');
    this.bookingNo.setValue('');

    this.paginator.pageIndex = 0;
    this.callSubject.next();
  }


  deleteContainer(id){
    const dialogRef = this.dialog.open(ConfirmComponent, {
      data: { title : 'Are you sure?' , id : id}
    });

    dialogRef.afterClosed().subscribe(result => {
      if(result){
        const fdata:FormData = new FormData();
        fdata.append('container_id',result);
        this.containerService.deleteContainer(fdata).subscribe(data => {
          this.dataSource.data = this.dataSource.data.filter(row => row.container_id != result);
        });
      }
    });
  }

  generateLink(url){
    if(url.indexOf('http') !== -1){
      return url;
    } else if(url.indexOf('https') !== -1){
      return url;
    }
    return `https://${url}`;
  }

  createFilter(): (data: any, filter: string) => boolean {
    let filterFunction = (data, filter):boolean => {
      let searchTerms = JSON.parse(filter);
      return data.shipper_name.toLowerCase().indexOf(searchTerms.shipper_name) !== -1
        && data.receiver_name.toString().toLowerCase().indexOf(searchTerms.receiver_name) !== -1
        && data.shipment_status_id.toString().toLowerCase().indexOf(searchTerms.shipment_status_id) !== -1
        && data.destination_name.toLowerCase().indexOf(searchTerms.destination_name) !== -1;
    }
    return filterFunction;
  }


  openPhoto(_container_id):void{
    let formData:FormData = new FormData();
      formData.append('container_id',_container_id);
      this.containerService.getContainerHistory(formData).subscribe(data => {
        if(data){
          let _dataImages = [];
          for(let i = 0 ; i < data.data.length; i++){
            let files = data.data[i].file;
            if(files && files.length > 0){
              for(let j = 0 ; j < files.length; j++){
                _dataImages.push(files[j]);
              }
            }
            //

            //this.images.push({path : data.data[i].file});
          }
          if(_dataImages.length > 0){
            this.gallery_items = _dataImages.map(item => new ImageItem({ src: item, thumb: item }));
            this.lightboxRef.load(this.gallery_items);
            this.lightbox.open(0, 'lightbox', {panelClass: 'fullscreen'});
          }

        }
      });
      /*
    const dialogRef = this.dialog.open(GalleryComponent, {
      data: {container_id : $container_id}
    });

    dialogRef.afterClosed().subscribe(result => {

    });*/
  }

  openFiles($container_id):void{
    const dialogRef = this.dialog.open(FilesComponent, {
      data: {container_id : $container_id}
    });

    dialogRef.afterClosed().subscribe(result => {

    });
  }

  savePDF() {
    document.body.classList.add('print_mode');
    this.exportAsService.save(this.exportAsConfig, 'containers').subscribe(() => {
      setTimeout(()=>{document.body.classList.remove('print_mode');},1000);
    });
  }

  printPage(){
    window.print();
  }

}
